export type ProjectReason = Readonly<{
  id: string;
  title: string;
  description: string;
  icon: "location" | "community" | "design" | "management" | "growth" | "transparency";
}>;

export type ProjectReasonsContent = Readonly<{
  label: string;
  title: string;
  titleEmphasis: string;
  description: string;
  reasons: readonly ProjectReason[];
  cta?: Readonly<{ title: string; description: string; label: string; href: string }>;
}>;
