import ContentEditor from "@/components/admin/ContentEditor";

export default function AdminContact() {
  return (
    <ContentEditor
      section="contact"
      title="Contact"
      fields={[
        { key: "badge", label: "Badge Text" },
        { key: "title", label: "Heading" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "phone", label: "Phone Number" },
        { key: "whatsapp", label: "WhatsApp Number" },
        { key: "email", label: "Email Address" },
        { key: "location", label: "Location" },
        { key: "facebook", label: "Facebook URL" },
        { key: "instagram", label: "Instagram URL" },
        { key: "youtube", label: "YouTube URL" },
        { key: "telegram", label: "Telegram URL" },
      ]}
    />
  );
}
