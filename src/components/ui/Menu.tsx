"use client";

// Menu suspenso (Radix DropdownMenu) no visual da marca: card com 12 px de
// raio, sem sombra, 4 px de distância do gatilho, entrada de 150 ms.

import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { usePortalContainer } from "./portal";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, className = "", sideOffset = 4, ...rest }: ComponentProps<typeof DropdownMenu.Content>) {
  const container = usePortalContainer();
  return (
    <DropdownMenu.Portal container={container}>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={`pop z-[80] max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[12rem] overflow-y-auto rounded-card border border-line bg-card p-1 text-fg shadow-pop outline-none ${className}`}
        {...rest}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

const itemCls =
  "flex h-9 cursor-default items-center gap-2.5 rounded-control px-2.5 text-[14px] outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-soft";

export function MenuItem({ children, icon, className = "", ...rest }: ComponentProps<typeof DropdownMenu.Item> & { icon?: ReactNode }) {
  return (
    <DropdownMenu.Item className={`${itemCls} ${className}`} {...rest}>
      {icon && <span className="inline-flex w-4 shrink-0 justify-center text-fg-2">{icon}</span>}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuCheckItem({ children, className = "", ...rest }: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem className={`${itemCls} ${className}`} {...rest}>
      <span className="inline-flex w-4 shrink-0 justify-center text-accent">
        <DropdownMenu.ItemIndicator>
          <Check size={15} aria-hidden />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-medium tracking-[0.06em] text-fg-2 uppercase">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}
