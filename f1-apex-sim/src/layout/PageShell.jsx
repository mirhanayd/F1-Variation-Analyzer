const PageShell = ({
  eyebrow,
  title,
  description,
  actions = null,
  children,
  compact = false,
}) => (
  <main className={`page-shell ${compact ? 'compact' : ''}`}>
    {(eyebrow || title || description || actions) && (
      <section className="page-hero">
        <div>
          {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
          {title && <h1>{title}</h1>}
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </section>
    )}
    {children}
  </main>
);

export default PageShell;
