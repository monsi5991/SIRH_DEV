import { useEffect } from "react";

const SITE_NAME = "SIRH Afrique de l'Ouest";
const DEFAULT_DESCRIPTION =
  "Logiciel RH pour centraliser congés, présence, dossiers salariés, validations et pilotage RH en Afrique de l'Ouest.";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export const pageMetaDefaults = {
  siteName: SITE_NAME,
  description: DEFAULT_DESCRIPTION,
};

export default function usePageMeta(title, description) {
  useEffect(() => {
    const normalizedTitle = normalizeText(title);
    const normalizedDescription = normalizeText(description) || DEFAULT_DESCRIPTION;

    document.title = normalizedTitle ? `${normalizedTitle} | ${SITE_NAME}` : SITE_NAME;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", normalizedDescription);
    }
  }, [title, description]);
}
