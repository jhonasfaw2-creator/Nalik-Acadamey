import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminHowYouLearn() {
  return (
    <ContentEditor
      section="how-you-learn"
      title="How You Learn"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "title", label: "Heading" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "step1_title", label: "Step 1 Title" },
        { key: "step1_text", label: "Step 1 Description", type: "textarea" },
        { key: "step2_title", label: "Step 2 Title" },
        { key: "step2_text", label: "Step 2 Description", type: "textarea" },
        { key: "step3_title", label: "Step 3 Title" },
        { key: "step3_text", label: "Step 3 Description", type: "textarea" },
        { key: "step4_title", label: "Step 4 Title" },
        { key: "step4_text", label: "Step 4 Description", type: "textarea" },
      ]}
    />
  );
}
