// Portfolio item type used by VideoCard component.
// Actual data is fetched from the database via /api/admin/our-work.

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  videoSrc: string;
  posterImage: string;
}
