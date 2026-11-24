import { forwardRef, type ButtonHTMLAttributes } from "react";
import { AppIcon, type IconName } from "./AppIcon";
import { Tooltip } from "./Surfaces";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title" | "children">;
interface IconButtonProps extends ButtonProps {
  label: string;
  icon: IconName;
  size?: "xs" | "sm" | "md";
  selected?: boolean;
  pressed?: boolean;
  danger?: boolean;
  shortcut?: string;
  tooltip?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "sm", selected, pressed, danger, shortcut, tooltip = label, className = "", ...button }, ref
) {
  const description = shortcut ? `${tooltip} ${shortcut}` : tooltip;
  return <Tooltip text={description}>
    <button {...button} ref={ref} type="button" className={`uiIconButton ${className}`}
      data-size={size} data-selected={selected || undefined} data-danger={danger || undefined}
      aria-label={label} aria-pressed={pressed} title={description}>
      <AppIcon name={icon} size={size === "xs" ? 14 : size === "md" ? 20 : 18}/>
      <span className="uiVisuallyHidden">{label}</span>
    </button>
  </Tooltip>;
});

interface ToolbarButtonProps extends Omit<IconButtonProps, "onClick"> {
  commandId: string;
  dispatch: (id: string) => void;
}
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  {commandId, dispatch, ...button}, ref
) {
  return <IconButton {...button} ref={ref} data-command={commandId} onClick={()=>dispatch(commandId)}/>;
});
