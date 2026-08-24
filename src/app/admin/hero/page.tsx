import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminHero() {
  return (
    <ContentEditor
      section="hero"
      title="Hero Section"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "title", label: "Main Title" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "video", label: "Video URL" },
        { key: "poster", label: "Poster Image URL" },
      ]}
    />
  );
}
