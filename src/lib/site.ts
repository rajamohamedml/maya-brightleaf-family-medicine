// Public site facts shared by links, share cards and the demo video.
export const SITE_URL = "https://brightleaf-family-medicine.lovable.app";

// Paste a YouTube or Loom link here to turn on /watch and the hero video link.
export const VIDEO_URL = "https://www.loom.com/share/ac02e5a17682417f80bbf777229d1e7e";

export function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  return null;
}
