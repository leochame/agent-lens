type EntryNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type HeroAsideBlock = {
  title: string;
  body: string;
};

type RenderHeroSectionOptions = {
  cardClassName?: string;
  eyebrow: string;
  title: string;
  description: string;
  pills?: string[];
  navItems?: EntryNavItem[];
  asideBlocks?: HeroAsideBlock[];
  asideContent?: string;
};

type RenderLinkCardOptions = {
  href: string;
  kicker: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
};

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function renderEntryNav(items: EntryNavItem[], ariaLabel = "页面入口"): string {
  const links = items.map((item) => {
    const className = item.active ? "entry-link active" : "entry-link";
    return `<a class="${className}" href="${item.href}">${item.label}</a>`;
  }).join("");

  return `<div class="entry-nav" aria-label="${ariaLabel}">${links}</div>`;
}

export function renderHeroSection(options: RenderHeroSectionOptions): string {
  const pills = (options.pills ?? [])
    .map((pill) => `<span class="meta-pill">${pill}</span>`)
    .join("");
  const nav = options.navItems?.length ? renderEntryNav(options.navItems) : "";
  const asideBlocks = (options.asideBlocks ?? [])
    .map((block) => `<div class="hero-side-card"><h2 class="hero-side-title">${block.title}</h2><div class="hero-side-copy">${block.body}</div></div>`)
    .join("");
  const sideContent = `${asideBlocks}${options.asideContent ?? ""}`;

  return `<section class="${joinClassNames(options.cardClassName, "hero")}">
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="eyebrow">${options.eyebrow}</span>
            <div>
              <h1>${options.title}</h1>
              <p class="hero-description">${options.description}</p>
            </div>
            ${pills ? `<div class="hero-meta">${pills}</div>` : ""}
            ${nav}
          </div>
          <aside class="hero-side">
            ${sideContent}
          </aside>
        </div>
      </section>`;
}

export function renderLinkCard(options: RenderLinkCardOptions): string {
  return `<a class="grid-card" href="${options.href}">
          <div class="section-kicker">${options.kicker}</div>
          <span class="eyebrow">${options.eyebrow}</span>
          <h2>${options.title}</h2>
          <p>${options.description}</p>
          <div class="go">${options.cta}</div>
        </a>`;
}
