"use client";

import clsx from "clsx";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactElement,
} from "react";

/**
 * Lightweight shadcn-compatible sidebar primitives for this repo.
 * Visual language matches ui.shadcn.com/docs/components/base/sidebar
 * without pulling in Radix Slot, CVA, Sheet, or Tooltip.
 */

function mergeChildClassName(
  child: ReactElement<{ className?: string }>,
  className: string,
) {
  return cloneElement(child, {
    className: clsx(className, child.props.className),
  });
}

export const Sidebar = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => (
    <aside
      ref={ref}
      className={clsx("dash-sidebar dash-sidebar--shadcn", className)}
      data-sidebar="sidebar"
      data-variant="floating"
      {...props}
    >
      {children}
    </aside>
  ),
);
Sidebar.displayName = "Sidebar";

export const SidebarHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-header", className)}
    data-sidebar="header"
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-footer", className)}
    data-sidebar="footer"
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-content", className)}
    data-sidebar="content"
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarGroup = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-group", className)}
    data-sidebar="group"
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement> & {
    asChild?: boolean;
  }
>(({ className, asChild = false, children, ...props }, ref) => {
  const classes = clsx("dash-sidebar-group-label", className);

  if (asChild && isValidElement(children)) {
    return mergeChildClassName(
      children as ReactElement<{ className?: string }>,
      classes,
    );
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={classes}
      data-sidebar="group-label"
      {...props}
    >
      {children}
    </div>
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-group-content", className)}
    data-sidebar="group-content"
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarMenu = forwardRef<
  HTMLUListElement,
  HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={clsx("dash-sidebar-menu", className)}
    data-sidebar="menu"
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = forwardRef<
  HTMLLIElement,
  HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={clsx("dash-sidebar-menu-item", className)}
    data-sidebar="menu-item"
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

type SidebarMenuButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  isActive?: boolean;
  size?: "default" | "sm" | "lg";
};

export const SidebarMenuButton = forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(
  (
    {
      className,
      asChild = false,
      isActive = false,
      size = "default",
      children,
      ...props
    },
    ref,
  ) => {
    const classes = clsx(
      "dash-sidebar-menu-button",
      size === "sm" && "dash-sidebar-menu-button--sm",
      size === "lg" && "dash-sidebar-menu-button--lg",
      isActive && "dash-sidebar-menu-button--active",
      className,
    );

    if (asChild) {
      const child = Children.only(children);
      if (isValidElement(child)) {
        return cloneElement(
          child as ReactElement<Record<string, unknown>>,
          {
            className: clsx(
              classes,
              (child.props as { className?: string }).className,
            ),
            "data-sidebar": "menu-button",
            "data-active": isActive ? "true" : undefined,
            "data-size": size,
          },
        );
      }
    }

    return (
      <button
        ref={ref}
        className={classes}
        data-active={isActive ? "true" : undefined}
        data-sidebar="menu-button"
        data-size={size}
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export const SidebarMenuBadge = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-menu-badge", className)}
    data-sidebar="menu-badge"
    {...props}
  />
));
SidebarMenuBadge.displayName = "SidebarMenuBadge";

export const SidebarSeparator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("dash-sidebar-separator", className)}
    data-sidebar="separator"
    role="separator"
    {...props}
  />
));
SidebarSeparator.displayName = "SidebarSeparator";

export type SidebarInputProps = ComponentPropsWithoutRef<"input">;

export const SidebarInput = forwardRef<
  ElementRef<"input">,
  SidebarInputProps
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx("dash-sidebar-input", className)}
    data-sidebar="input"
    {...props}
  />
));
SidebarInput.displayName = "SidebarInput";
