import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { initials } from "@/lib/format";
import { Menu } from "@/components/layout/menu";
import type { SessionUser } from "@/lib/types";

export function AccountMenu({ user, settings }: { user: SessionUser; settings: boolean }) {
  return (
    <Menu className="account-menu">
      <summary className="avatar-btn" aria-label="Account menu">
        {user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="40px" /> : <span>{initials(user.fullName)}</span>}
      </summary>
      <div className="account-drop">
        <div className="account-id">
          <strong>{user.fullName}</strong>
          <small>{user.roleName}</small>
        </div>
        <Link href="/profile">Profile</Link>
        {settings ? <Link href="/settings">Settings</Link> : null}
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </Menu>
  );
}
