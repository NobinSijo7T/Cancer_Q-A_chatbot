import React from 'react';
import { Text } from 'react-native';

function findSingleItalicStart(text, i) {
  for (let j = i; j < text.length; j++) {
    if (text[j] === '*' && text[j + 1] !== '*') return j;
  }
  return -1;
}

function findSingleUnderStart(text, i) {
  for (let j = i; j < text.length; j++) {
    if (text[j] === '_' && text[j + 1] !== '_') return j;
  }
  return -1;
}

function findClosingSingleAsterisk(text, start) {
  for (let j = start; j < text.length; j++) {
    if (text[j] === '*') {
      if (text[j + 1] === '*') {
        j++;
        continue;
      }
      return j;
    }
  }
  return -1;
}

function findClosingSingleUnderscore(text, start) {
  for (let j = start; j < text.length; j++) {
    if (text[j] === '_') {
      if (text[j + 1] === '_') {
        j++;
        continue;
      }
      return j;
    }
  }
  return -1;
}

/**
 * Parse markdown-like inline markup into a flat list of typed segments.
 * Bold: **text** or __text__. Italic: *text* or _text_ (not ** or __).
 */
export function parseRichParts(text) {
  if (text == null || text === '') return [];
  const nodes = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end === -1) {
        nodes.push({ type: 'text', text: text.slice(i) });
        break;
      }
      nodes.push({ type: 'bold', inner: text.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    if (text.startsWith('__', i)) {
      const end = text.indexOf('__', i + 2);
      if (end === -1) {
        nodes.push({ type: 'text', text: text.slice(i) });
        break;
      }
      nodes.push({ type: 'bold', inner: text.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    if (text[i] === '*' && text[i + 1] !== '*') {
      const close = findClosingSingleAsterisk(text, i + 1);
      if (close !== -1) {
        nodes.push({ type: 'italic', inner: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    if (text[i] === '_' && text[i + 1] !== '_') {
      const close = findClosingSingleUnderscore(text, i + 1);
      if (close !== -1) {
        nodes.push({ type: 'italic', inner: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    let next = text.length;
    const dStar = text.indexOf('**', i);
    const dUnder = text.indexOf('__', i);
    const sStar = findSingleItalicStart(text, i);
    const sUnder = findSingleUnderStart(text, i);
    for (const p of [dStar, dUnder, sStar, sUnder]) {
      if (p !== -1 && p < next) next = p;
    }
    if (next === i) {
      nodes.push({ type: 'text', text: text[i] });
      i += 1;
      continue;
    }
    nodes.push({ type: 'text', text: text.slice(i, next) });
    i = next;
  }
  return nodes;
}

function renderRichParts(nodes, styles, keyPrefix) {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (node.type === 'text') {
      return (
        <Text key={key}>
          {node.text}
        </Text>
      );
    }
    const innerParsed = parseRichParts(node.inner);
    const children =
      innerParsed.length > 0
        ? renderRichParts(innerParsed, styles, key)
        : node.inner;

    if (node.type === 'bold') {
      return (
        <Text key={key} style={styles.boldText}>
          {children}
        </Text>
      );
    }
    if (node.type === 'italic') {
      return (
        <Text key={key} style={styles.italicText}>
          {children}
        </Text>
      );
    }
    return null;
  });
}

/**
 * React Native <Text> children for bot messages: **bold**, __bold__, *italic*, _italic_, nested.
 */
export function renderRichTextElements(text, styles) {
  if (text == null || text === '') return null;
  const nodes = parseRichParts(text);
  return renderRichParts(nodes, styles, 'm');
}
