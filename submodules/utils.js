// Utility Module

const hexToRgba = (hex, alpha) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = "0x" + hex[1] + hex[1];
      g = "0x" + hex[2] + hex[2];
      b = "0x" + hex[3] + hex[3];
    } else if (hex.length === 7) {
      r = "0x" + hex[1] + hex[2];
      g = "0x" + hex[3] + hex[4];
      b = "0x" + hex[5] + hex[6];
    }
    return `rgba(${+r}, ${+g}, ${+b}, ${alpha})`;
  };
  
const insertHtmlOnNewLine = (html) => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const el = document.createElement('div');
      el.innerHTML = html;
      range.insertNode(el);
      range.setStartAfter(el);
      range.setEndAfter(el);
      selection.removeAllRanges();
      selection.addRange(range);
    }
};

const restoreCursorPosition = (element, position) => {
    const range = document.createRange();
    const sel = window.getSelection();
    let charCount = 0;
    let found = false;

    const traverseNodes = (node) => {
        if (found) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent.length;
            if (charCount + textLength >= position) {
                range.setStart(node, position - charCount);
                found = true;
            } else {
                charCount += textLength;
            }
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                traverseNodes(node.childNodes[i]);
                if (found) break;
            }
        }
    }

    traverseNodes(element);
    if (!found) {
        range.setStart(element, element.childNodes.length);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
};
  
export default {
    hexToRgba,
    insertHtmlOnNewLine,
    restoreCursorPosition,
};
  