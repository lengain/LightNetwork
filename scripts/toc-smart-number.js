"use strict";
const { tocObj, encodeURL, escapeHTML } = require("hexo-util");

// Matches headings whose text already starts with manual numbering
//   Arabic: 1.  1.1  1.1.1  1)  (1)  （1）
//   Chinese: 一、 二、  1、2、
//   Circled: ① ② ③
const MANUAL_NUM_RE =
  /^\s*([\d]+(?:\.[\d]+)*[.\s、，\)）》]|[\d一二三四五六七八九十]+[、．\.\s]|[（(][\d]+[）)]|[①②③④⑤⑥⑦⑧⑨⑩①-⑳])/;

function hasManualNumbering(text) {
  return MANUAL_NUM_RE.test(text.trim());
}

// Override the built-in toc helper with smart numbering:
// - Headings that already have manual numbering: NO auto-number prefix, but counter still increments
// - Headings without manual numbering: auto-number prefix shown normally
hexo.extend.helper.register("toc", function (str, options) {
  options = Object.assign(
    {
      min_depth: 1,
      max_depth: 6,
      max_items: Infinity,
      class: "toc",
      class_item: "",
      class_link: "",
      class_text: "",
      class_child: "",
      class_number: "",
      class_level: "",
      list_number: true,
    },
    options
  );

  const data = getAndTruncateTocObj(
    str,
    { min_depth: options.min_depth, max_depth: options.max_depth },
    options.max_items
  );
  if (!data.length) return "";

  const className = escapeHTML(options.class);
  const itemClassName = escapeHTML(
    options.class_item || options.class + "-item"
  );
  const linkClassName = escapeHTML(
    options.class_link || options.class + "-link"
  );
  const textClassName = escapeHTML(
    options.class_text || options.class + "-text"
  );
  const childClassName = escapeHTML(
    options.class_child || options.class + "-child"
  );
  const numberClassName = escapeHTML(
    options.class_number || options.class + "-number"
  );
  const levelClassName = escapeHTML(
    options.class_level || options.class + "-level"
  );
  const listNumber = options.list_number;

  let result = `<ol class="${className}">`;
  const lastNumber = [0, 0, 0, 0, 0, 0];
  let firstLevel = 0;
  let lastLevel = 0;

  for (let i = 0, len = data.length; i < len; i++) {
    const el = data[i];
    const { level, id, text } = el;
    const href = id ? `#${encodeURL(id)}` : null;

    if (!el.unnumbered) {
      lastNumber[level - 1]++;
    }
    for (let j = level; j <= 5; j++) {
      lastNumber[j] = 0;
    }

    if (firstLevel) {
      for (let j = level; j < lastLevel; j++) {
        result += "</li></ol>";
      }
      if (level > lastLevel) {
        result += `<ol class="${childClassName}">`;
      } else {
        result += "</li>";
      }
    } else {
      firstLevel = level;
    }

    result += `<li class="${itemClassName} ${levelClassName}-${level}">`;
    if (href) {
      result += `<a class="${linkClassName}" href="${href}">`;
    } else {
      result += `<a class="${linkClassName}">`;
    }

    // Smart numbering: only show auto-number if NOT unnumbered AND
    // the heading text doesn't already start with manual numbering
    if (listNumber && !el.unnumbered && !hasManualNumbering(text)) {
      result += `<span class="${numberClassName}">`;
      for (let j = firstLevel - 1; j < level; j++) {
        result += `${lastNumber[j]}.`;
      }
      result += "</span> ";
    }

    result += `<span class="${textClassName}">${text}</span></a>`;
    lastLevel = level;
  }

  for (let i = firstLevel - 1; i < lastLevel; i++) {
    result += "</li></ol>";
  }
  return result;
});

function getAndTruncateTocObj(str, options, max_items) {
  let data = tocObj(str, {
    min_depth: options.min_depth,
    max_depth: options.max_depth,
  });
  if (data.length === 0) return data;
  if (max_items < 1 || max_items === Infinity) return data;

  const levels = data.map((item) => item.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  for (
    let currentLevel = max;
    data.length > max_items && currentLevel > min;
    currentLevel--
  ) {
    data = data.filter((item) => item.level < currentLevel);
  }
  data = data.slice(0, max_items);
  return data;
}
