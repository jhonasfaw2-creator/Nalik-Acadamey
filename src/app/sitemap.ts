import type { MetadataRoute } from "next";
import { LONG_FORM_PROJECTS } from "@/lib/portfolio";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const homepage = `${siteUrl}/`;

  return [
    {
      url: homepage,
      priority: 1,
      changeFrequency: "weekly",
      images: [
        `${siteUrl}/assets/hero/poster.jpg`,
        `${siteUrl}/assets/About/poster.jpg`,
        `${siteUrl}/assets/natiii.jpg`,
      ],
      videos: LONG_FORM_PROJECTS.filter(
        (project) => project.platform === "YouTube" && project.youtubeId
      ).map((project) => ({
        title: project.title,
        description: project.description || project.title,
        thumbnail_loc: project.thumbnailUrl,
        player_loc: `https://www.youtube.com/embed/${project.youtubeId}`,
      })),
    },
  ];
}
