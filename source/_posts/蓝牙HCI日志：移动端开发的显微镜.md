---
title: 蓝牙HCI日志：移动端开发的显微镜
date: 2026-04-28 10:42:43
tags: 技术
categories: 技术
---

你在手机上打开开发者选项，点下“启用蓝牙 HCI 信息收集日志”，然后复现那个偶现的连接闪断。十几秒后，你拿到一份日志（Android 是 `btsnoop_hci.log`，iOS 是 PacketLogger 捕获的 `.pklg`）。用 Wireshark 打开，迎面而来的是满屏的时间戳、十六进制和缩写：`CMD`、`EVT`、`ACL`、`LE Meta`。

多数移动端开发者到这里就放弃了。

但真相是：**HCI 日志是蓝牙协议栈唯一不会说谎的部分**。上层 API 的异常、系统回调的延迟、固件的怪异行为，在 HCI 层都会留下精确到微秒的痕迹。无论你开发的是 Android 还是 iOS 应用，一旦学会阅读它，你就拥有了一双透视协议栈的“显微眼”。

本文将兼顾广度与深度，从协议栈分层讲起，到二进制位级拆解，再到真实案例实战，并通过 **Android 与 iOS 的双端对比**，让你彻底掌握用 HCI 日志跨平台排查问题的能力。

---

## 一、HCI 是什么？为什么它至关重要？

### 1.1 蓝牙的“大脑”与“身体”：Host 与 Controller

要搞懂 HCI，必须先理清蓝牙系统的两个核心角色：**Host（主机）** 和 **Controller（控制器）**。

**打一个经典的比方：你用手机 App 连接一个蓝牙体温计。**

- **Host (主机)**：手机上的**软件部分**。包括你的 App、操作系统里的蓝牙协议栈（Android 的 Bluedroid/Fluoride，iOS 的 CoreBluetooth）。它负责高层逻辑，如“连接哪个设备”“把体温数据解析显示到屏幕上”“弹出配对对话框”。
- **Controller (控制器)**：手机里的**蓝牙射频芯片及其固件**。它只负责最底层的硬件操作，如“在物理信道 37 上发一个广播包”“以 30 微妙精度在约定时刻回复数据”。

**那么，在你的手机和体温计之间，角色具体怎样分布？**

<!--more-->

| 角色             | **手机（中心设备）**               | **体温计（外设）**               |
|:-------------- |:-------------------------- |:------------------------- |
| **Host**       | App + 系统蓝牙协议栈（Android/iOS） | 嵌入式 MCU 上运行的应用代码          |
| **Controller** | 高通/博通/联发科/苹果自研的蓝牙芯片        | Nordic/Dialog/TI 等低功耗蓝牙芯片 |

交互链路是：
**手机 App (Host) ↔ 手机蓝牙芯片 (Controller) ↔ 无线电波 ↔ 体温计蓝牙芯片 (Controller) ↔ 体温计固件 (Host)**

**【关键认知】HCI 就是定义手机内部 Host 软件与 Controller 芯片之间如何对话的标准语言。** 这个接口是标准化的，与操作系统无关。**无论 Android 还是 iOS，它们发送的 HCI 命令格式完全相同**，这正是跨平台抓包分析的基石。

### 1.2 双端共识：HCI 日志是最诚实的“底层证词”

主机和控制器通过硬件接口（UART、USB、SDIO 等）通信，其上运行的标准化协议就是 **HCI (Host Controller Interface)**。

- 你的 App 调用 `startDiscovery()` (Android) 或 `scanForPeripherals(withServices:)` (iOS)，最终都会转为一条 HCI `Inquiry` 或 `LE Set Scan Enable` 命令发给 Controller。
- 设备断连时，Controller 的第一手信息永远是上报给 Host 的 HCI `Disconnection Complete` 事件。

**你在 Android 和 iOS 上层看到的任何异常，如果追不到 HCI 层的根因，就永远是猜测。** 而正因为 HCI 层是通用的，你可以用相同的方法论分析两个平台的日志。

### 1.3 日志中的核心概念速览（双端通用）

在深入日志前，先将反复出现的关键词说清楚。

#### 基础概念

- **BD_ADDR（蓝牙设备地址）**：设备的唯一标识，像 MAC 地址一样。Android 和 iOS 扫描到的地址格式可能不同（Public 或 Random），但追踪设备时都以它为准。
- **Connection Handle（连接句柄）**：连接建立后，Controller 分配的一个临时编号（12 位），后续所有数据收发都用这个”号”而不再用长地址。它是连接在日志里的”临时身份证”。
- **RSSI（接收信号强度指示）**：单位 dBm，负值越小信号越弱（-30 贴着设备，-90 快断了）。日志中每个 `LE Advertising Report` 都附带 RSSI，是判断距离和干扰的第一手依据。
- **PHY（物理层速率）**：BLE 物理信道编码方式。`LE 1M`（默认 1 Mbps）、`LE 2M`（2 Mbps、吞吐翻倍但距离稍短）、`LE Coded`（125/500 kbps、远距离但速率低）。日志中 `LE Set PHY` 或 `LE PHY Update Complete` 事件反映当前协商结果。
- **MTU（最大传输单元）**：ATT 层单次能传输的最大有效载荷字节数。默认 23 字节（ATT 头部 3 + 数据 20），可通过 `Exchange MTU Request/Response`（在 ACL 的 L2CAP 信令信道 `0x0005` 中）协商到更大值。**MTU 必须配合 DLE 才能真正提升吞吐**，单独增大 MTU 而不开 DLE 会被链路层分片抵消收益。
- **DLE（数据长度扩展）**：BLE 4.2+ 的特性，将链路层单包载荷从 27 字节提升至 251 字节。日志中检查 `LE Set Data Length` 命令/事件是否出现。与 MTU 的关系：DLE 扩大链路层”袋子”，MTU 决定 ATT 层往袋子装多少”货”。

#### L2CAP 与上层协议

- **L2CAP（逻辑链路控制与适配协议）**：位于 HCI ACL 之上，用 Channel ID 将数据流分发给不同上层协议：
  - `0x0004` → **ATT**（属性协议）：BLE GATT 的基石，定义数据（温度、电量）如何读写和通知。
  - `0x0005` → **L2CAP 信令**：MTU 协商、连接参数更新请求等控制命令。
  - `0x0006` → **SMP（安全管理协议）**：处理 BLE 配对和加密，密钥分发。
- **GATT（通用属性配置文件）**：基于 ATT 的高层抽象，开发者通过 Service UUID 和 Characteristic UUID 交互。数据交互方式：Read / Write / Write Command（无响应写，OTA 首选）/ Notify / Indicate。
- **GAP（通用访问配置文件）**：定义 BLE 设备的四种角色——Broadcaster、Observer、Peripheral、Central，以及设备发现、连接建立、安全模式。所有 BLE 通信的”骨架”。

#### 经典蓝牙 (BR/EDR) 常见 Profile

经典蓝牙（非 BLE）使用 RFCOMM 等协议承载各类 Profile，也走 ACL 信道，在 HCI 日志中同样可见：

- **SDP（服务发现协议）**：经典蓝牙的服务注册中心。设备连接后先查 SDP，获得对方支持的 Profile 列表及 RFCOMM 信道号。HCI 日志中在 ACL 连接初期出现，通过 L2CAP 信令信道交互。
- **RFCOMM（射频通信协议）**：在 L2CAP 之上模拟串口（RS-232），为上层 Profile 提供顺序可靠的数据流。相当于经典蓝牙的”TCP”。HCI 中表现为 ACL 数据，L2CAP Channel 由 SDP 动态分配。
- **A2DP（高级音频分发配置文件）**：经典蓝牙音乐传输。单向高带宽音频流（SBC/AAC/aptX/LDAC 编码），使用 AVDTP 协议。日志特征：ACL 持续大数据量，通常单独占用较大的 ACL 包，对射频环境要求高。
- **HFP（免提配置文件）**：经典蓝牙通话音频。双向低带宽 SCO/eSCO 链路收发 8kHz/16kHz 语音。HCI 日志特征：出现 SCO/eSCO 报文，`Setup Synchronous Connection` 命令/事件。配对时 HFP 常涉及 `+BRSF`（AT 命令，交换支持特性）、`+CIND`（指示器状态）等交互。
- **AVRCP（音频/视频远程控制配置文件）**：经典蓝牙媒体控制——播放/暂停/切歌/音量。基于 AVCTP 协议走 ACL，数据量很小。HCI 中表现为偶尔的 ACL 包，可与 A2DP 同一连接的不同 L2CAP Channel。
- **HID（人机接口设备配置文件）**：经典/LE 键盘鼠标等输入设备。使用中断通道传输按键/坐标，控制通道传输状态。日志中走 L2CAP，特点是小包高频、低延迟要求。
- **PBAP（电话簿访问配置文件）**：经典蓝牙同步通讯录/通话记录，基于 OBEX 协议，通常车机/车载场景出现。
- **SPP（串口配置文件）**：经典蓝牙最通用的数据通道，直接基于 RFCOMM。大量经典蓝牙设备（GPS 模块、OBD 诊断仪、打印机）走 SPP 传数据。HCI 中表现为持续 ACL 数据流。

**速记要点**：凡是”音乐”走 A2DP，”电话”走 HFP，”切歌/按键”走 AVRCP，”手表通知/OTA 升级”通常走 BLE GATT。

---

## 二、HCI 报文四大类别（双端完全一致）

HCI 日志只包含四种报文类型。无论 Android 还是 iOS，类型和含义完全一样：

| 类型缩写         | 全称               | 方向                | 说明                    |
| ------------ | ---------------- | ----------------- | --------------------- |
| **CMD**      | HCI Command      | Host → Controller | 主机下发的指令，如发起扫描、建立连接    |
| **EVT**      | HCI Event        | Controller → Host | 控制器对命令的响应及异步通知        |
| **ACL**      | ACL Data         | 双向                | 承载上层 L2CAP 数据的异步无连接信道 |
| **SCO/eSCO** | Synchronous Data | 双向                | 通话等同步音频数据（开发中较少关注）    |

一个完整交互通常是：CMD → EVT (Command Status) → ... → EVT (Command Complete/对应异步事件)。ACL 数据则是连接建立后两端传递的应用数据载体。

---

## 三、解剖一份 HCI 日志的结构（双端格式对比）

- **Android** 生成的是 `btsnoop_hci.log`，遵循 BT Snoop 规范，Wireshark 可直接打开。
- **iOS** 需借助 PacketLogger 捕获 `*.pklg` 文件，同样可在 Wireshark 中直接解析（需要安装 Xcode 的额外工具）。**PacketLogger 也支持导出为 `btsnoop` 格式**，实现双端统一分析。

每一行记录包含：

- 时间戳（微秒级精度）
- 方向：`Sent`（Host→Controller）或 `Received`（Controller→Host）
- 报文类型与 Wireshark 自动解析的摘要

**底层二进制结构完全一样**，保证了分析知识双端通用：

```
HCI Packet Type (1 byte) | 报文数据...
```

- `0x01` = Command
- `0x02` = ACL Data
- `0x04` = Event
- ……（其他同规范）

Command 内部 Opcode 的 OGF/OCF 编码，Event 的内部结构，**两个平台没有任何区别**，所以后面的命令表和事件表可跨平台使用。

---

## 四、双端差异专题：Android 与 iOS 在 HCI 视角下的典型不同

虽然 HCI 命令通用，但两个平台在**蓝牙协议栈策略、后台行为和应用层实现**上的差异，会直接反映在 HCI 日志里。以下是关键不同点：

### 4.1 扫描与连接行为

| 行为     | Android                                                                               | iOS                                                                              |
| ------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 扫描参数控制 | 应用可通过 API 设置 `ScanSettings` (ScanMode, MatchMode)，底层会反映在 `LE Set Scan Parameters` 命令中 | iOS 的 `CBCentralManager` 扫描参数高度封装，开发者无法直接控制 Duty Cycle 等底层细节，HCI 中看到的扫描参数由系统智能调节 |
| 后台扫描   | Android 后台持续扫描会触发系统限制，但某些机型可通过设置提高扫描频率；HCI 中可看到频繁的 `LE Set Scan Enable` 开关            | iOS 后台扫描严格受限，系统会强制使用低占空比扫描，甚至合并扫描窗口，HCI 中看到的 `LE Advertising Report` 频率明显低于前台    |
| 多连接支持  | 可同时连接多个外设，HCI 中用不同 Connection Handle 分流                                               | 也支持多连接，但系统可能对无数据通信的连接进行“搁置”，HCI 中会看到主动的 `Disconnect` 命令                          |

### 4.2 配对与安全

| 行为            | Android                                                                                         | iOS                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| IO Capability | 通常为 `DisplayYesNo` 或 `KeyboardDisplay`，视机型而定，`IO Capability Request` 事件会反映                      | iOS 固定为 `DisplayYesNo`（无键盘），HCI 事件中看到的 `IO Capability Response` 会传递此值                                                            |
| 配对主动断开        | Android 遇到配对失败后，应用可能收到 `onAuthenticationFailed`，HCI 里常见 `Link Key Request Negative Reply` 或直接断连 | iOS 配对失败会通过 `centralManager(_:didFailToConnect:error:)` 回调，HCI 中常表现为系统直接发送 `Disconnect`，Reason 如 `0x05` (Authentication Failure) |
| Bond 持久化      | Android 配对后 link key 通常保存在芯片的 NVRAM 或系统文件，断电不丢失                                                 | iOS 的配对信息存储在 Host 端，Controller 重启后需由 Host 重新加载，HCI 中可能看到系统主动重配（`Link Key Request` 后 Host 给予回复）                                   |

### 4.3 连接参数更新与 PHY

- **连接参数更新**：Android 作为中心时，可用 `requestConnectionPriority()` 请求连接优先级，会在 HCI 中触发 `LE Connection Update` 命令；iOS 不允许中心主动请求更新，而是由外设发起 `L2CAP Connection Parameter Update Request`（在 ACL 数据中可见），系统自动响应。
- **PHY 协商**：Android 8.0+ 支持请求 2M PHY 或 Coded PHY，可在 HCI 中看到 `LE Set PHY` 命令；iOS 虽然也支持，但对 PHY 的切换更为保守，倾向于保持 1M PHY，HCI 中很少看到主动 PHY 切换请求。

### 4.4 后台行为与断连

- **Android**：后台运行的服务如果未被杀死，连接通常能保持，HCI 中 ACL 数据流持续。
- **iOS**：App 进入后台后，蓝牙连接通常可维持一段时间，但系统可能因资源管理主动 休眠 Controller 或发送 `Disconnect`（Reason 常为 `0x16` Connection Terminated by Local Host）。在 HCI 日志中，你会看到突如其来的本地主动断连。

**排查启示**：同一个 BLE 外设，在 Android 和 iOS 上表现不一致时，不要急着怀疑外设，先抓两端的 HCI 日志对比。很可能 iOS 在某个行为上比 Android“更克制”，而外设固件被暴露了兼容性问题。

---

## 五、关键 HCI 报文：从此看懂日志的主体脉络

以下命令和事件表在两个平台的分析中通用。**特别注意**：部分事件在 iOS 的 PacketLogger 中会被标记为 `CoreBluetooth` 相关的上层过滤，但在 HCI 层看来一样。

### 5.1 命令类 (CMD) 核心指令

**经典蓝牙 (BR/EDR) 常用：**

| 命令                                      | Opcode          | 作用                                   |
| --------------------------------------- | --------------- | ------------------------------------ |
| Inquiry                                 | `0x0401`        | 搜索经典蓝牙设备                             |
| Create Connection                       | `0x0405`        | 发起 ACL 连接                            |
| Disconnect                              | `0x0406`        | 断开连接，参数中带 Connection Handle 和 Reason |
| Link Key Request Reply / Negative Reply | `0x040B/0x040C` | 回应配对时的 Link Key 请求                   |

**BLE 常用：**

| 命令                     | Opcode   | 作用           |
| ---------------------- | -------- | ------------ |
| LE Set Scan Parameters | `0x200B` | 设置 BLE 扫描参数  |
| LE Set Scan Enable     | `0x200C` | 开启/关闭 BLE 扫描 |
| LE Create Connection   | `0x200D` | 发起 BLE 连接    |
| LE Start Encryption    | `0x2019` | 启动链路层加密      |

**注意**：无论 Android 还是 iOS，如果看到 `LE Create Connection` 之后长时间没有 `LE Connection Complete` 事件，就高度怀疑是射频/距离/外设广播间隔等物理层问题。这一判断标准双端完全一致。

### 5.2 事件类 (EVT) 核心状态

| 事件                     | Event Code        | 关键信息及双端差异提示                                                                                                     |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Disconnection Complete | `0x05`            | **Reason Code** 是排查断连的第一切入点。双端常见 Reason：`0x08` (Connection Timeout)、`0x13` (PIN or Key Missing)、`0x16` (本地主动断开) |
| LE Connection Complete | `0x3E` 子事件 `0x01` | BLE 连接结果，含 Handle、Role、Interval 等。Android 和 iOS 下发的超时参数可能不同，导致成功率差异                                             |
| LE Advertising Report  | `0x3E` 子事件 `0x02` | 扫描到的广播包。iOS 可能因扫描窗口窄而漏报                                                                                         |
| Encryption Change      | `0x08`            | 加密状态变更。双端在配对后用此事件确认加密是否已开启                                                                                      |

**BLE 子事件速查：**

| 子事件                                    | 代码     | 关键点                                                     |
| -------------------------------------- | ------ | ------------------------------------------------------- |
| LE Connection Complete                 | `0x01` | 连接结果，包含 Connection Handle、Role、Interval、Latency、Timeout |
| LE Enhanced Connection Complete (5.0+) | `0x0A` | 多了 Peer Address Type 等                                  |
| LE Advertising Report                  | `0x02` | 含 RSSI、广播数据                                             |

### 5.3 ACL 数据：上层协议的窥视孔

ACL 数据头部包含 Connection Handle。紧跟的 L2CAP 层：

- Channel ID `0x0004`：ATT 协议（GATT 数据）
- Channel ID `0x0005`：L2CAP 信令（MTU 协商、连接参数更新请求）
- Channel ID `0x0006`：SMP（配对加密）

**双端差异体现**：连接参数更新请求由外设发起，iOS 和 Android 都会在 ACL 数据（`0x0005`）中收到 `L2CAP Connection Parameter Update Request`。但 Android 中心可能拒绝并主动发起更新，iOS 则被动接受或忽略。这一交互在 ACL 层清晰可见。

---

## 六、状态码速查表：日志里最直白的线索

| HCI Status Code (hex) | 宏定义                                 | 典型场景                        |
| --------------------- | ----------------------------------- | --------------------------- |
| `0x00`                | Success                             | 正常                          |
| `0x08`                | Connection Timeout                  | BLE 连接超时，双端均常见              |
| `0x0B`                | Connection Already Exists           | Android 上可能因快速重连导致，iOS 较少见  |
| `0x0C`                | Command Disallowed                  | 状态不允许，如未连接就发数据              |
| `0x13`                | PIN or Key Missing                  | 配对缺少密钥，双端均可能出现              |
| `0x16`                | Connection Terminated by Local Host | 本地主动断开，**iOS 后台被系统挂起时极为常见** |
| `0x3B`                | Unacceptable Connection Parameters  | 从机拒绝连接参数更新，外设固件问题，双端表现一致    |

---

## 七、HCI 数据洪流：读懂 OTA 升级与流量控制

### 1. 日志里反复出现的 `Number Of Completed Packets` 是什么？

这是 HCI 层**控制器→主机方向的流量控制**事件。

- 当主机通过 ACL 向控制器发送数据时，控制器内部有一个**ACL 缓冲区**，用来暂存待发送到空中的 HCI 数据包。这个缓冲区大小有限（通常由 `Read Buffer Size` 命令在初始化时获取）。
- 控制器每成功地将一些数据包传输给对方，就会通过 `Number Of Completed Packets` 事件通知主机：“我已经处理完了连接句柄 `0x004A` 上的 `0x0002` 个数据包，你可以继续发新的了。”
- 主机根据这些事件释放对应的缓冲区计数，从而可以继续下发新的 ACL 数据包。

**iOS日志示例**：

```
Apr 21 18:23:48.687  HCI Event        0x004A  xxx           Number Of Completed Packets - Handle: 0x004A - Packets: 0x0002    
Apr 21 18:23:48.687  ATT Send         0x004A  xxx           Write Command - Handle:0x0026 - Value: 2F00 B200 4541 E7C7 0197 A790 25F7 FD0F…  
Apr 21 18:23:48.687  ATT Send         0x004A  xxx           Write Command - Handle:0x0026 - Value: 3000 B200 8A7A 78DF 527F B817 A0C4 258B…  
Apr 21 18:23:48.687  HCI Event        0x004A  xxx           Number Of Completed Packets - Handle: 0x004A - Packets: 0x0002    
Apr 21 18:23:48.687  ATT Send         0x004A  xxx           Write Command - Handle:0x0026 - Value: 3100 B200 AE05 42D1 40A7 A481 DF4E 61D7…  
Apr 21 18:23:48.687  ATT Send         0x004A  xxx           Write Command - Handle:0x0026 - Value: 3200 B200 818A 38D0 E823 E5EF C1E7 CB36…  
Apr 21 18:23:48.710  HCI Event        0x004A  xxx           Number Of Completed Packets - Handle: 0x004A - Packets: 0x0002    
Apr 21 18:23:48.710  ATT Send         0x004A  xxx           Write Command - Handle:0x0026 - Value: 3300 B200 50F5 3384 0568 337F C9F3 902D…  
Apr 21 18:23:48.710  ATT Send         0x004A  xxx           Write Command - Handle:0x0026 - Value: 3400 B200 79AD 4325 F5E6 ECB8 ABBB 02FC…  
```

紧跟着立刻又有两个 `ATT Send`（实际是两条 ACL 数据包），仅 **23ms** 后（48.687 → 48.710）再次收到 Completed 2 事件，如此循环。这说明**主机是受控地、按控制器释放缓冲区的节奏来发包**，形成了典型的”发送-确认-再发送”流水线。23ms 的紧凑间隔意味着 Controller 几乎每个 Connection Interval 都在满负荷工作。

### 2. HCI 层的双向流量控制

移动开发者通常只关注上层数据，但 HCI 层的流量控制直接影响 OTA 升级速率。它有两条独立的控制路径：

- **主机→控制器（Host to Controller）**：主机维护一个可发送的 ACL 数据包计数（`LE-Available-Buffers`）。每发一个包计数减 1，收到 `Number Of Completed Packets` 事件后计数增加相应的数值。计数为零时，主机必须停止发送，直到有新的完成事件。
- **控制器→主机（Controller to Host）**：类似，有 `HC_Total_ACL_Data_Packets` 等控制。

**认识不到这个机制，就很难从日志中理解为什么数据发送不是一泻千里，而是一批一批、有节奏地进行的。**

### 3. 从日志估算吞吐量

可以直接利用 `Number Of Completed Packets` 事件和时间戳快速评估当前连接的实际传输速率。

拿上面这段日志举例，分三步估算：

**第一步：从时间戳推算 Connection Interval。**
相邻 `Number Of Completed Packets` 事件的时间差就是实际的连接间隔。日志中 18:23:48.687 → 48.710 间隔约 **23ms**，这就是当前链路的 Connection Interval。BLE 规范允许 7.5ms ~ 4s，23ms 属于吞吐优先的紧凑配置，接近 iOS/Android 系统推荐的 30ms 下限，说明 Host 端连接参数已配置到位。

**第二步：从 Completed Packets 数量推算每间隔有效载荷。**
每个间隔内控制器完成 2 个数据包（`Packets: 0x0002`），紧随其后主机立刻下发 2 个新的 `ATT Write Command`。这种”完成 2 个 → 再发 2 个”的稳定节奏说明每间隔能发出 2 个链路层包，流水线跑满无空转。

每个 `ATT Write Command` 的 Value 字段可直观看出有效载荷大小（日志中每行露出约 16 字节的十六进制数据）。假设使用默认 MTU=185，则每个 Write 可携带 182 字节有效负载（ATT 头部 3 字节 + 数据 182 字节）。每间隔有效吞吐量为 2 × 182 = **364 字节**。

**第三步：计算实际速率，定位优化方向。**
当前实际吞吐量：364 字节 / 23ms ≈ **15.8 KB/s**。

这个速率已经是默认 MTU 下的较优水平——23ms 间隔接近系统下限，流水线满负荷运转。要进一步提速，关键是提升**单包载荷**，而非继续压缩连接间隔（已经没有多少空间了）：

- **仅增大 MTU**：将 MTU 从 185 协商到 512，每个 Write Command 可携带 509 字节。但若未启用 DLE，链路层单包仍被限制在 27 字节，一个 509 字节的 Write 会被拆成约 19 个链路层包分批发送。以每间隔 2 包计算，完成一次传输需约 10 个连接间隔（23 ms/间隔），实际吞吐仅从约 2.0 KB/s 微升至约 2.2 KB/s，收效甚微。

- **MTU + DLE**：启用 DLE 后链路层单包载荷从 27 字节跃升至 251 字节，一个 509 字节的 Write Command 仍需 3 个链路层包。每间隔 2 包需 2 个间隔（46 ms）完成，吞吐约为 509 / 46 ms ≈ 11.1 KB/s，反而不及 MTU 185 时的 15.8 KB/s（因 182 字节可单包满载）。这揭示了一个关键点：为最大化吞吐，MTU 值应设为 n × (链路层最大载荷)，例如取 502 字节（2×251），使一个 Write 恰好被整包数装满。

- **MTU + DLE + 2M PHY**：若双方协商到 2M PHY，每间隔可容纳更多链路层包（假设翻倍至 4 包），则 509 字节的 3 个包可在单个间隔内发完，吞吐跃升至 509 / 23 ms ≈ 22.1 KB/s，较 1M PHY 下提升近一倍。若配合优化后的 MTU 值，吞吐还可进一步提高。

关键结论：**DLE 是 OTA 吞吐的分水岭**。未启用 DLE 时，即使 MTU 增大，链路层分片也会抵消大部分收益。抓日志时应重点检查连接建立初期是否有 `LE Set Data Length` 交互，这比盯着 Connection Interval 更能解释”为什么 OTA 还是慢”。

**在日志中：`LE Connection Complete` 确认 Interval，`Number Of Completed Packets` 频率判断流水线是否跑满，`Exchange MTU` 和 `LE Set Data Length` 交互确认载荷上限——三步定位吞吐瓶颈。**

关于开启 `MTU + DLE + 2M PHY` 的组合，iOS和安卓会有不同的策略。

#### iOS：自动优化的“黑盒”

iOS 的策略侧重于**自动化**，它会基于硬件和系统状态，主动向设备请求更好的连接参数。

* **MTU**：建立连接时，iOS 系统会自动发起 MTU 协商，请求使用双方都支持的最大值。目前 iOS 支持的最大 MTU 为 **185 字节**，最终值以设备和手机回复中的较小值为准。开发者没有开放的 API 来干预此过程。
* **DLE / 2M PHY**：这两个涉及物理层的参数优化，由 iOS 系统在底层根据外围设备的能力自动完成，开发者同样无法通过 API 干预。从 iPhone 8/X 开始，iOS 设备在连接到支持 2M PHY 的外设时，会**自动尝试将连接切换到更快的 2M PHY**。如果外设也支持 DLE，系统同样会和 2M PHY 一起自动完成协商。

#### Android：应用主导的灵活配置

与 iOS 相反，Android 的策略是**将选择权交给开发者**，其默认行为非常保守，但向上优化的空间更大。

* **MTU**：Android 的默认 MTU 同样是 **23 字节**。但开发者可以主动调用 `requestMtu()` 方法来请求更大的值。需要注意的是，Android 14 引入了一个新的默认行为：当应用**首次**调用 `requestMtu()` 时，系统可能会自动请求 **517 字节**的 MTU（旨在以一包承载最大 512 字节的特征值），但如果外设不支持，系统仍能退回使用协商后的值。
* **DLE / 2M PHY**：Android 不会自动请求 DLE 或 2M PHY。**默认使用 LE 1M PHY** 进行连接。开发者需要通过 `BluetoothGatt` 的相关方法（如 `setPreferredPhy()`）主动请求所需的 PHY。

### 4. 为什么用 `ATT Write Command` 而不是 `Write Request`？

OTA 升级时，数据传输追求高吞吐和低延迟，不容忍每个包都要等待对端应用层回复 `Write Response`。

- **Write Command**：ATT 层发出后不需要对端 ATT 层回复，直接交给链路层排队发送。这在 HCI 日志中表现为一连串的 `ATT Send`（Host→Controller）而没有对应的 `ATT Receive`（Write Response）。真正的确认由链路层的 ACK 负责，主机通过 `Number Of Completed Packets` 获知数据已传达到对方链路层。
- 如果 OTA 用 `Write Request`，每个数据包都必须等待对端回 `Write Response` 才能发下一个，吞吐量将直接腰斩甚至更低。

你的日志中连续出现 `Write Command`，正是高效 OTA 的最佳实践。

### 5. 影响吞吐量的关键因素在日志中的体现

当发现 OTA 升级慢，查看 HCI 日志时，**按优先级从高到低**检查以下点：

- **DLE (Data Length Extension)** —— **吞吐的第一杠杆**：在连接初期检查是否有 `LE Set Data Length` 命令/事件。若支持，链路层单包最大载荷从 27 字节提升到 251 字节，每间隔能塞入的数据量直接跃升一个数量级。**注意 DLE 和 MTU 缺一不可**：DLE 扩大了链路层袋子，但 MTU 决定了 ATT 层往袋子里装多少货。只有 DLE 没有 MTU 协商，袋子大了但装的还是 20 字节；只有 MTU 没有 DLE，货多了但袋子小，链路层分片会把收益吃光。前面日志示例中如果启用了 DLE + MTU=185，吞吐量能从 1.74 KB/s 跃升到约 15.8 KB/s，这就是为什么 DLE 是分水岭。
- **MTU**：通过 ACL 数据中的 L2CAP 信令（`Exchange MTU Request/Response`）查看是否协商了更大的 MTU。默认 MTU=23 只能让每个 ATT Write Command 携带 20 字节有效数据。协商到 185 以上后，配合 DLE 才能充分发挥。
- **Connection Interval 和每间隔数据包数**：从 `LE Connection Complete` 事件确认 `Interval` 值，再结合 `Number Of Completed Packets` 节奏判断每间隔实际完成包数。前面示例的 23ms 间隔和稳定每间隔 2 包，说明连接参数已较优。但如果你的日志显示间隔在 100ms 以上、或每间隔仅完成 1 个包，则应先排查连接参数和外设固件配置。
- **射频环境与重传**：如果 `Number Of Completed Packets` 事件的间隔忽大忽小而非稳定节奏，说明信道上有干扰触发了重传，有效速率被拉低。此时检查 RSSI 变化和周边 2.4GHz 设备密度。

### 6.  iOS 蓝牙传输速率综合对比表

| 场景                 | 技术模式       | iOS 典型实际速率 (应用层)  | 理论上限 (物理层)   | 关键限制与要求                           | 使用方式 / API                  |
| ------------------ | ---------- | ----------------- | ------------ | --------------------------------- | --------------------------- |
| 单 BLE (Central)    | GATT       | 30 - 70 KB/s      | 1M/2M PHY    | 受限于 Connection Interval (最小 15ms) | writeValue(withoutResponse) |
| 单 BLE (Central)    | L2CAP CoC  | 110 - 150 KB/s    | 2M PHY       | iOS 11+; 需外设端支持 Credit 流控         | openL2CAPChannel (流操作)      |
| 单 BLE (Peripheral) | GATT/L2CAP | 通常更低 (10-30 KB/s) | 1M/2M PHY    | iOS 充当外设时，系统给予的带宽极低               | CBPeripheralManager         |
| 单经典蓝牙              | iAP2 (MFi) | 约 75 - 120 KB/s   | 3 Mbps (EDR) | MFi 强制认证；受限于 iAP2 封包开销            | ExternalAccessory.framework |
| 单经典蓝牙              | 音频 (A2DP)  | ~40 - 60 KB/s     | 3 Mbps       | 系统自动接管，不开放给第三方 App 传私有数据          | AVFoundation / 系统路由         |
| 双模同时               | BLE + 经典蓝牙 | 各自下降 40% - 60%    | 共享天线         | 天线分时复用；音频流会严重挤占 BLE 带宽            | CoreBluetooth + EA 同时运行     |

*本表数据综合了公开测试及行业讨论。实际传输速率受设备型号（如 iPhone 16 与旧款差异）、系统版本、连接参数（如 MTU 大小、连接间隔）、射频环境（如 Wi-Fi 干扰）及配件固件优化等多因素影响，应以真机实测为准*

### 7.Android 蓝牙速率综合对比表

| 场景                 | 技术模式       | 典型实际速率 (应用层)   | 理论上限 (物理层)   | 核心瓶颈与现状                                          | 使用方式 / API          |
| ------------------ | ---------- | -------------- | ------------ | ------------------------------------------------ | ------------------- |
| 单 BLE (Central)    | GATT       | 30 - 80 KB/s   | 1M/2M PHY    | 需手动请求 CONNECTION_PRIORITY_HIGH 和 requestMtu(517) | writeCharacteristic |
| 单 BLE (Central)    | L2CAP CoC  | 40 - 100 KB/s  | 2M PHY       | 避坑项：部分固件在 L2CAP 下 DLE 无法触发，导致速率甚至低于 GATT         | createL2capChannel  |
| 单 BLE (Peripheral) | GATT/L2CAP | ~60 KB/s       | 1M/2M PHY    | 依赖手机作为外设时的 MTU 协商策略，性能波动极大                       | CBPeripheralManager |
| 单经典蓝牙              | SPP (串口)   | 100 - 250 KB/s | 3 Mbps (EDR) | 上限高、下限极低：老旧或廉价模块可能跌至 10 KB/s                     | BluetoothSocket     |
| 单经典蓝牙              | 音频 (A2DP)  | ~15 - 120 KB/s | 3 Mbps       | 即 120kbps-990kbps 码率；受限于编码器（SBC/AAC/LDAC）        | 系统自动处理              |
| 双模同时               | BLE + 经典   | 各自下降 30% - 70% | 共享天线         | 射频干扰严重，经典蓝牙高负载（如传文件）会导致 BLE 断连                   | 并发操作多个 Socket       |

*本表旨在反映 Android 碎片化环境下的中位数水平。开发者在立项时，建议以表中低值作为基准线进行体验设计。实际速率以真机实测为准*

## 八、三大实战案例：双端对比排查

### 案例一：BLE 连接失败，Android 返回 133，iOS 返回 0x10

**现象**：同一外设，Android 报 `GATT_ERROR (Status 133)`，iOS 回调错误码 `CBError.Code.connectionTimeout`。抓取两端 HCI 日志对比：

- **Android 日志**：`Sent LE Create Connection` 后 6 秒收到 `LE Connection Complete`，Status = `0x08` (Connection Timeout)。
- **iOS 日志**：同样是 `Sent LE Create Connection` 后约 6 秒超时，但紧接着 iOS 系统额外发送了 `Disconnect`（Reason = 0x16），因为 iOS 在连接超时后会自动清理资源。

**分析**：问题根源相同——外设广播间隔太大（比如 1.2 秒），导致两台手机在规定窗口内都完不成三次握手。双端现象一致，验证了是外设问题，而非平台兼容性。

**解决**：通知固件工程师将外设广播间隔缩短至 100ms 以内，并适当增加连接超时容限。

### 案例二：经典蓝牙配对后 iOS 闪断，Android 正常

**HCI 日志片段（iOS 端）**：

```
CMD: Link Key Request Reply (回复了保存的 Link Key)
EVT: Encryption Change (Encryption Enabled: True)
EVT: Disconnection Complete (Reason: 0x05 - Authentication Failure)
```

**Android 端**：完全相同的交互序列，但断连未发生。

**分析**：加密成功后立即断连，且 Reason 为认证失败。这往往是因为 iOS 保存的 Link Key 与对端设备当前存储的不一致（可能是外设重启后 Key 已失效，但 Android 尝试重新配对而 iOS 重连时直接使用了旧 Key）。iOS 在某些外设配对上更强调安全验证，导致快速判死。

**解决**：让用户在 iOS 上“忽略此设备”后重新配对，或在 App 中监听断连并自动触发重新配对流程。

### 案例三：BLE Notify 数据 iOS 有时收不到，Android 正常

**HCI 日志对比**：

- Android 日志：CCCD 写入成功 → MTU 交换成功 → 持续收到 Notify。
- iOS 日志：CCCD 写入成功，但之后**没有** Exchange MTU 请求，过一会收到 `ATT Error Response (Insufficient Authentication)`，随后 iOS 主动断开。

**分析**：iOS 的安全策略要求某些特征值通知必须经 **MITM 保护配对**（Authenticated Encryption）。Android 可能在非 MITM 条件下也能收发，而 iOS 的 CoreBluetooth 在收到错误后为了安全直接断连。

**解决**：外设特性需要设置正确的安全权限（`SM` 标记），App 端需确保完成 `authenticate` 的配对，HCI 中就能看到 `LE Start Encryption` 后 ACL 的 SMP 交互升级为 Authenticated。

---

## 九、移动端抓取 HCI 日志的实用方法（双端对比）

### Android

1. 开启开发者选项：设置 → 关于手机 → 连续点击版本号。
2. 进入开发者选项 → 网络 → 开启 **“启用蓝牙 HCI 信息收集日志”**（三星等叫“Bluetooth HCI snoop log”）。
3. 复现问题后，**一定关闭该开关**（否则缓冲区不刷新到文件）。
4. 导出 `/sdcard/btsnoop_hci.log`，用 Wireshark 打开。

### iOS

iOS 需要借助 **PacketLogger**（Xcode 额外工具）和**蓝牙调试配置文件**。

1. 安装 Xcode → 打开菜单 “Xcode” → “Open Developer Tool” → “More Developer Tools”，下载对应版本的 “Additional Tools”，得到 PacketLogger。
2. 使用 Apple 开发者账号创建 **蓝牙诊断配置文件** (`BluetoothDebugProfile.mobileconfig`)，安装到 iOS 设备。
3. iOS 设备上：设置 → 通用 → 关于本机 → 证书信任设置，启用配置文件。
4. 将 iOS 设备通过 USB 连接 Mac，打开 PacketLogger，选择设备，点击“开始录制”。
5. 复现问题后停止录制，保存文件。PacketLogger 支持导出为 `pklg` 或 `btsnoop` 格式，直接用 Wireshark 分析。

**双端比较**：Android 获取便捷，但不同厂商日志开关位置和稳定性不一；iOS 门槛高，但捕获到的 HCI 数据更纯净，干扰项少。

---

## 十、Wireshark 实用过滤表达式（双端通用）

- `hci_h4.type == 0x01`：只看命令
- `hci_h4.type == 0x04`：只看事件
- `bthci_evt.code == 0x05`：只看 Disconnection Complete，快速定位所有断连
- `btle.advertising_data`：过滤 BLE 广播包
- `btatt`：只看 ATT 交互（所有 GATT 操作）
- `btl2cap.cid == 0x0006`：只看 SMP 配对过程
- `(bthci_evt.code == 0x3e) && (btle.evt.code == 0x01)`：只看 LE Connection Complete

**双端高级技巧**：右键任意报文选择 “Follow → Bluetooth HCI Trace”，可按连接句柄或地址流追踪整条链路。Android 和 iOS 的日志均支持此操作。

---

## 十一、进阶视角：连接句柄 (Connection Handle) 的生命周期

当看到 Connection Complete 事件，Controller 会分配一个 **Connection Handle**（12位，`0x0001-0x0EFF`）。此后该连接的所有 CMD、ACL 都带这个 Handle。

- 不同设备占用不同 Handle，多设备时用 Handle 过滤即可分离各链路。
- 对未分配的 Handle 操作会返回 `No Connection (0x02)`。
- `Disconnection Complete` 事件后 Handle 回收。

**双端一致**，这是排查多连接问题（手表+耳机）的利器。

---

## 十二、总结：日志是蓝牙的“内心独白”，双端皆通

曾经有开发者对我说：“HCI 日志看起来像外星语。”我回答：“当你理解了它的语法，它就成了蓝牙设备无声的证词。而且这份证词在 Android 和 iOS 上是通用的。”

连接失败、闪断、数据发不出、配对弹窗不出现……两个平台上所有模糊不清的 Bug，在 HCI 日志中都有确切的原因码。**移动端开发者的核心竞争力，不仅在于写出连接代码，更在于能从底层日志中一刀切中问题要害，并且能自如地在 Android 和 iOS 两种“表达方式”间切换理解。**

下一次，当用户反馈“只有 iPhone 连不上”或“安卓会掉线”，不要盲目猜测系统差异，而是默默打开两端的 HCI 日志，让它们互相印证。

**记住三个最核心的排查套路（双端通用）：**

1. 看事件序列的时间差，过长的时间间隔就是问题方向。
2. 看每条命令后的 Status 或 Command Complete 返回码，不为零即异常。
3. 看 Disconnection Complete 的 Reason Code，那是断开链条的最终链条。

现在，带着这些知识和双端对比的视角，去重新审视你的 BLE 连接超时、配对异常和 GATT 交互迷雾。你看到的，将不再是十六进制的荒野，而是蓝牙协议精密运转的壮丽图景，无论它在 Android 还是 iOS 上书写。
