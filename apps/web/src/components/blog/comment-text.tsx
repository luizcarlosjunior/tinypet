import { Fragment } from "react";
import { COMMENT_LINK_REL, tokenizeComment } from "@/server/blog/text";

/** Plain-text comment: escaped by React, line breaks kept, http(s) links autolinked (nofollow ugc). */
export function CommentText({ body }: { body: string }) {
  return (
    <p className="whitespace-normal break-words text-sm leading-relaxed">
      {tokenizeComment(body).map((t, i) =>
        t.type === "br" ? (
          <br key={i} />
        ) : t.type === "link" ? (
          <a key={i} href={t.href} rel={COMMENT_LINK_REL} target="_blank" className="text-brand-600 underline underline-offset-2 dark:text-brand-400">
            {t.text}
          </a>
        ) : (
          <Fragment key={i}>{t.value}</Fragment>
        ),
      )}
    </p>
  );
}
