import { useEffect, useMemo, useRef } from "react";
import { buildBlogContentHtml } from "../../utils/blog";

interface SimpleRichEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

type InlineTag = "strong" | "em";
type BlockTag = "p" | "h2" | "h3" | "blockquote";

const BLOCK_TAGS = new Set(["P", "H2", "H3", "BLOCKQUOTE", "LI"]);

function normalizeHtml(value: string): string {
  return buildBlogContentHtml(value).trim();
}

function findClosestBlock(node: Node, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && BLOCK_TAGS.has(current.tagName)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function getEditorRange(root: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }

  return range;
}

function replaceBlockTag(block: HTMLElement, tag: BlockTag) {
  if (block.tagName.toLowerCase() === tag) {
    return;
  }

  const next = document.createElement(tag);
  while (block.firstChild) {
    next.appendChild(block.firstChild);
  }
  block.replaceWith(next);
}

function wrapRange(range: Range, tagName: InlineTag) {
  if (range.collapsed) {
    return;
  }

  const wrapper = document.createElement(tagName);
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
  range.setStartAfter(wrapper);
  range.collapse(true);
}

function replaceSelectionWithList(range: Range, root: HTMLElement) {
  const text = range.toString().trim();
  const block = findClosestBlock(range.startContainer, root);
  const sourceText = text || block?.textContent?.trim() || "";
  if (!sourceText) {
    return;
  }

  const items = sourceText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0) {
    return;
  }

  const list = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });

  if (block) {
    block.replaceWith(list);
  } else {
    range.deleteContents();
    range.insertNode(list);
  }
}

export function SimpleRichEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: SimpleRichEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = useMemo(() => normalizeHtml(value), [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
  }, [normalizedValue]);

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    onChange(editor.innerHTML);
  };

  const applyInline = (tag: InlineTag) => {
    const editor = editorRef.current;
    if (!editor || disabled) {
      return;
    }

    const range = getEditorRange(editor);
    if (!range) {
      return;
    }

    wrapRange(range, tag);
    onChange(editor.innerHTML);
  };

  const applyBlock = (tag: BlockTag) => {
    const editor = editorRef.current;
    if (!editor || disabled) {
      return;
    }

    const range = getEditorRange(editor);
    if (!range) {
      return;
    }

    const block = findClosestBlock(range.startContainer, editor);
    if (block) {
      replaceBlockTag(block, tag);
    } else {
      const wrapper = document.createElement(tag);
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }

    onChange(editor.innerHTML);
  };

  const applyList = () => {
    const editor = editorRef.current;
    if (!editor || disabled) {
      return;
    }

    const range = getEditorRange(editor);
    if (!range) {
      return;
    }

    replaceSelectionWithList(range, editor);
    onChange(editor.innerHTML);
  };

  const applyLink = () => {
    const editor = editorRef.current;
    if (!editor || disabled) {
      return;
    }

    const range = getEditorRange(editor);
    if (!range || range.collapsed) {
      return;
    }

    const url = window.prompt("Enter a URL");
    if (!url) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "nofollow sponsored";
    anchor.appendChild(range.extractContents());
    range.insertNode(anchor);
    range.setStartAfter(anchor);
    range.collapse(true);
    onChange(editor.innerHTML);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyBlock("p")}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          Paragraph
        </button>
        <button
          type="button"
          onClick={() => applyBlock("h2")}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => applyBlock("h3")}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => applyInline("strong")}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => applyInline("em")}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          Italic
        </button>
        <button
          type="button"
          onClick={applyList}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          Bullet List
        </button>
        <button
          type="button"
          onClick={() => applyBlock("blockquote")}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          Quote
        </button>
        <button
          type="button"
          onClick={applyLink}
          disabled={disabled}
          className="rounded-full border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition hover:border-[#ff9900]/40"
        >
          Link
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder || "Write your article..."}
        className="min-h-[320px] w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm leading-7 text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
        suppressContentEditableWarning
      />
    </div>
  );
}
