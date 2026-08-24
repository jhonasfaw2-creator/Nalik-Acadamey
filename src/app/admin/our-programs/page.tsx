import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminOurPrograms() {
  return (
    <ContentEditor
      section="our-programs"
      title="Our Programs"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "title", label: "Heading" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "item1_title", label: "Program 1 Title" },
        { key: "item1_text", label: "Program 1 Description", type: "textarea" },
        { key: "item2_title", label: "Program 2 Title" },
        { key: "item2_text", label: "Program 2 Description", type: "textarea" },
        { key: "item3_title", label: "Program 3 Title" },
        { key: "item3_text", label: "Program 3 Description", type: "textarea" },
        { key: "item4_title", label: "Program 4 Title" },
        { key: "item4_text", label: "Program 4 Description", type: "textarea" },
      ]}
    />
  );
}
