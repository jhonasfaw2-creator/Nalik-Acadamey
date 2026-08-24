import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminAbout() {
  return (
    <ContentEditor
      section="about"
      title="About Section"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "title", label: "Heading" },
        { key: "paragraph1", label: "Paragraph 1", type: "textarea" },
        { key: "paragraph2", label: "Paragraph 2", type: "textarea" },
        { key: "video", label: "Video URL" },
        { key: "poster", label: "Poster Image URL" },
      ]}
    />
  );
}
