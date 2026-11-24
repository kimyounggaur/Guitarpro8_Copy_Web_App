import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../overlays/useDialogFocus";
import "../styles/primitives.css";

function useAnchoredStyle(anchor: RefObject<HTMLElement>, panel: RefObject<HTMLElement>, open: boolean, side: "bottom" | "right") {
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!anchor.current || !panel.current) return;
      const target = anchor.current.getBoundingClientRect();
      const {width, height} = panel.current.getBoundingClientRect();
      const edge = 6;
      const left = side === "bottom" ? target.left
        : target.right + width + edge <= innerWidth ? target.right + edge : target.left - width - edge;
      const below = target.bottom + edge;
      const top = side === "right" ? target.top : below + height + edge <= innerHeight ? below : target.top - height - edge;
      setStyle({left: Math.max(edge, Math.min(left, innerWidth - width - edge)), top: Math.max(edge, Math.min(top, innerHeight - height - edge))});
    }
    position();
    const observer = new ResizeObserver(position);
    if (anchor.current) observer.observe(anchor.current);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [anchor, panel, open, side]);
  return style;
}

type TriggerProps = { "aria-describedby"?: string };
export function Tooltip({ text, children }: { text: string; children: ReactElement<TriggerProps> }) {
  const id = useId(), anchor = useRef<HTMLSpanElement>(null), body = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const style = useAnchoredStyle(anchor, body, open, "bottom");
  function hide() { clearTimeout(timer.current); setOpen(false); }
  function show() { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 350); }
  useEffect(() => () => clearTimeout(timer.current), []);
  return <span ref={anchor} className="uiTooltipAnchor" onPointerEnter={show} onPointerLeave={hide}
    onFocus={show} onBlur={hide} onPointerDown={hide} onKeyDown={event => { if(event.key === "Escape") hide(); }}>
    {cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], open && id].filter(Boolean).join(" ") || undefined })}
    {open && createPortal(<div ref={body} id={id} role="tooltip" className="uiTooltip" style={style}>{text}</div>, document.body)}
  </span>;
}

export interface PopoverProps {
  open: boolean; anchor: RefObject<HTMLElement>; onClose: () => void; children: ReactNode;
  label: string; id?: string; side?: "bottom" | "right"; className?: string;
}
export function Popover({open, anchor, onClose, children, label, id, side = "bottom", className = ""}: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => {close.current = onClose;}, [onClose]);
  const style = useAnchoredStyle(anchor, panel, open, side);
  useEffect(() => {
    if(!open) return;
    function outside(event: PointerEvent) {
      const target = event.target;
      if(target instanceof Node && !panel.current?.contains(target) && !anchor.current?.contains(target)) close.current();
    }
    function escape(event: globalThis.KeyboardEvent) {
      if(event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault(); close.current(); anchor.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);};
  }, [anchor, open]);
  if(!open) return null;
  return <div ref={panel} id={id} role="group" aria-label={label} style={style} className={`uiPopover ${className}`}>{children}</div>;
}

export function Dialog({open, title, description, children, onClose}: {open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void}) {
  const ref=useRef<HTMLDialogElement>(null), heading=useId(), text=useId();
  useDialogFocus(ref, open, "native");
  return open ? createPortal(<dialog ref={ref} className="uiDialog" aria-labelledby={heading} aria-describedby={description ? text : undefined}
    onCancel={event=>{ event.preventDefault(); onClose(); }}>
    <h2 id={heading}>{title}</h2>{description && <p id={text}>{description}</p>}{children}
  </dialog>,document.body) : null;
}

const menuSelector = 'button[role^="menuitem"]:not(:disabled)';
export function Menu({label,children,onClose,autoFocus=true}: {label:string;children:ReactNode;onClose?:()=>void;autoFocus?:boolean}) {
  const menu=useRef<HTMLDivElement>(null), search=useRef({text:"",time:0});
  function items(){return Array.from(menu.current?.querySelectorAll<HTMLButtonElement>(menuSelector) ?? []).filter(el=>el.closest('[role="menu"]')===menu.current);}
  useLayoutEffect(()=>{if(autoFocus)items()[0]?.focus();},[autoFocus]);
  function keyDown(event:KeyboardEvent<HTMLDivElement>){
    if(event.defaultPrevented||event.target instanceof Element && event.target.closest('[role="menu"]')!==menu.current)return;
    const available=items(), index=available.indexOf(document.activeElement as HTMLButtonElement);
    if(!available.length) return;
    let next:HTMLButtonElement|undefined;
    switch(event.key){
      case "ArrowDown":next=available[(index+1)%available.length];break;
      case "ArrowUp":next=available[(index-1+available.length)%available.length];break;
      case "Home":next=available[0];break;
      case "End":next=available[available.length-1];break;
      case "Escape": if(onClose){event.preventDefault();onClose();}return;
      default:
        if(event.key.length!==1 || !event.key.trim() || event.ctrlKey || event.metaKey || event.altKey)return;
        const now=performance.now(), char=event.key.toLocaleLowerCase();
        const prefix=now-search.current.time<550 && search.current.text!==char ? search.current.text+char : char;
        search.current={text:prefix,time:now};
        next=[...available.slice(index+1),...available.slice(0,index+1)].find(item=>(item.getAttribute("aria-label")??item.textContent??"").trim().toLocaleLowerCase().startsWith(prefix));
    }
    if(next){event.preventDefault();next.focus();}
  }
  return <div role="menu" aria-label={label} ref={menu} className="uiMenu" onKeyDown={keyDown}>{children}</div>;
}
export function MenuItem({children,shortcut,checked,...rest}: ButtonHTMLAttributes<HTMLButtonElement>&{shortcut?:string;checked?:boolean}){
  return <button {...rest} type="button" tabIndex={-1} role={checked===undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={checked} className="uiMenuItem">
    <span>{children}</span>{shortcut && <kbd>{shortcut}</kbd>}
  </button>;
}
export function MenuSeparator(){return <hr role="separator" className="uiMenuSeparator"/>;}
export function Submenu({label,children}:{label:string;children:ReactNode}){
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),id=useId();
  function close(){setOpen(false);trigger.current?.focus();}
  return <div onKeyDown={event=>{if(open && event.key==="ArrowLeft"){event.preventDefault();close();}}}>
    <button ref={trigger} type="button" role="menuitem" tabIndex={-1} aria-haspopup="menu" aria-expanded={open}
      aria-controls={open?id:undefined} className="uiMenuItem" onClick={()=>setOpen(!open)}
      onKeyDown={event=>{if(event.key==="ArrowRight"){event.preventDefault();setOpen(true);}}}>{label}<span aria-hidden="true">›</span></button>
    <Popover open={open} id={id} anchor={trigger} label={label} side="right" onClose={()=>setOpen(false)}>
      <Menu label={label} onClose={close}>{children}</Menu>
    </Popover>
  </div>;
}
