import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, Heading3,
  Quote, Link as LinkIcon, Image as ImageIcon, Undo, Redo, AlignLeft, AlignCenter, AlignRight, Strikethrough, Code,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Lightweight rich text editor (contentEditable + execCommand).
 * Stores/returns sanitized HTML.
 */
export const RichTextEditor = ({ value, onChange, placeholder, minHeight = 280 }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value when it changes (e.g. when editing different item)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML || "");
  };

  const insertLink = () => {
    const url = prompt("Masukkan URL:");
    if (url) exec("createLink", url);
  };
  const insertImage = () => {
    const url = prompt("Masukkan URL gambar:");
    if (url) exec("insertImage", url);
  };
  const heading = (level: 1 | 2 | 3) => exec("formatBlock", `H${level}`);

  const btn = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <Button
      type="button" size="icon" variant="ghost" className="h-8 w-8"
      title={label} onClick={onClick} onMouseDown={(e) => e.preventDefault()}
    >
      {icon}
    </Button>
  );

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
        {btn("Heading 1", <Heading1 className="h-4 w-4" />, () => heading(1))}
        {btn("Heading 2", <Heading2 className="h-4 w-4" />, () => heading(2))}
        {btn("Heading 3", <Heading3 className="h-4 w-4" />, () => heading(3))}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn("Bold", <Bold className="h-4 w-4" />, () => exec("bold"))}
        {btn("Italic", <Italic className="h-4 w-4" />, () => exec("italic"))}
        {btn("Underline", <Underline className="h-4 w-4" />, () => exec("underline"))}
        {btn("Strikethrough", <Strikethrough className="h-4 w-4" />, () => exec("strikeThrough"))}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn("Bullet list", <List className="h-4 w-4" />, () => exec("insertUnorderedList"))}
        {btn("Numbered list", <ListOrdered className="h-4 w-4" />, () => exec("insertOrderedList"))}
        {btn("Quote", <Quote className="h-4 w-4" />, () => exec("formatBlock", "BLOCKQUOTE"))}
        {btn("Code", <Code className="h-4 w-4" />, () => exec("formatBlock", "PRE"))}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn("Align left", <AlignLeft className="h-4 w-4" />, () => exec("justifyLeft"))}
        {btn("Align center", <AlignCenter className="h-4 w-4" />, () => exec("justifyCenter"))}
        {btn("Align right", <AlignRight className="h-4 w-4" />, () => exec("justifyRight"))}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn("Link", <LinkIcon className="h-4 w-4" />, insertLink)}
        {btn("Gambar", <ImageIcon className="h-4 w-4" />, insertImage)}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn("Undo", <Undo className="h-4 w-4" />, () => exec("undo"))}
        {btn("Redo", <Redo className="h-4 w-4" />, () => exec("redo"))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="prose prose-sm max-w-none p-3 outline-none text-foreground [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_img]:rounded [&_img]:my-2 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:font-mono [&_pre]:text-xs"
        style={{ minHeight }}
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onBlur={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      />
      <style>{`[contenteditable][data-placeholder]:empty:before{content:attr(data-placeholder);color:hsl(var(--muted-foreground));pointer-events:none;}`}</style>
    </div>
  );
};
