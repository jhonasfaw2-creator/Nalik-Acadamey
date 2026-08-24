import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminWhatWeTeach() {
  return (
    <ContentEditor
      section="what-we-teach"
      title="What We Teach"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "title", label: "Heading" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "tool1_name", label: "Tool 1 Name" },
        { key: "tool1_desc", label: "Tool 1 Description", type: "textarea" },
        { key: "tool2_name", label: "Tool 2 Name" },
        { key: "tool2_desc", label: "Tool 2 Description", type: "textarea" },
        { key: "tool3_name", label: "Tool 3 Name" },
        { key: "tool3_desc", label: "Tool 3 Description", type: "textarea" },
        { key: "tool4_name", label: "Tool 4 Name" },
        { key: "tool4_desc", label: "Tool 4 Description", type: "textarea" },
      ]}
    />
  );
}
