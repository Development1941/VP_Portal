import Image from "next/image";
import { redirect } from "next/navigation";
import { saveAvatarAction, saveProfileAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { PageHeader } from "@/components/common/ui";
import { initials } from "@/lib/format";
import { getSession } from "@/lib/session";

export default async function ProfilePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" />
      <section className="card profile-layout">
        <ActionForm action={saveAvatarAction} className="profile-photo">
          <div className="avatar-btn avatar-lg">
            {user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="96px" /> : <span>{initials(user.fullName)}</span>}
          </div>
          <label className="field">
            <span>Profile picture</span>
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <Submit>Upload picture</Submit>
        </ActionForm>
        <ActionForm action={saveProfileAction} className="form-grid">
          <label className="field">
            <span>Full name</span>
            <input name="fullName" defaultValue={user.fullName} required />
          </label>
          <label className="field">
            <span>Title</span>
            <input name="title" defaultValue={user.title} placeholder="Job title" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" defaultValue={user.phone} />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={user.email} readOnly />
          </label>
          <label className="field">
            <span>Role</span>
            <input value={user.roleName} readOnly />
          </label>
          <label className="field wide">
            <span>About</span>
            <textarea name="about" rows={4} defaultValue={user.about} placeholder="Professional summary" />
          </label>
          <Submit>Save profile</Submit>
        </ActionForm>
      </section>
    </>
  );
}
