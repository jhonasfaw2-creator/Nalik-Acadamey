import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminFounders() {
  return (
    <ContentEditor
      section="founders"
      title="Founders"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "name", label: "Founder Name" },
        { key: "role", label: "Role / Title" },
        { key: "bio", label: "Bio", type: "textarea" },
        { key: "video", label: "Video URL" },
        { key: "poster", label: "Poster Image URL" },
      ]}
    />
  );
}
