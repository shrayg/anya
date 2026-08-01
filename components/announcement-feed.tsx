"use client";

import clsx from "clsx";

import { SITE_ANNOUNCEMENTS } from "@/config/announcements";

function formatAnnouncementDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AnnouncementFeed({
  className,
  itemClassName,
}: {
  className?: string;
  itemClassName?: string;
}) {
  if (SITE_ANNOUNCEMENTS.length === 0) {
    return (
      <p className={clsx("site-updates-empty", className)}>
        No updates right now. Check back soon.
      </p>
    );
  }

  return (
    <ul className={clsx("site-updates-list", className)}>
      {SITE_ANNOUNCEMENTS.map((item) => (
        <li key={item.id} className={clsx("site-updates-item", itemClassName)}>
          <div className="site-updates-item-meta">
            <span className="site-updates-item-kind">
              {item.kind === "status" ? "Status" : "Update"}
            </span>
            <time dateTime={item.date}>{formatAnnouncementDate(item.date)}</time>
          </div>
          <h3 className="site-updates-item-title">{item.title}</h3>
          {item.body.split("\n\n").map((paragraph, index) => (
            <p key={`${item.id}-p${index}`} className="site-updates-item-body">
              {paragraph}
            </p>
          ))}
          {item.signOff ? (
            <p className="site-updates-item-signoff">— {item.signOff}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
