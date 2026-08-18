"use server";

import { redirect } from "next/navigation";
import { createSessionForLogin, destroyCurrentSession } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await createSessionForLogin(email, password);

  if (!user) {
    redirect("/login?error=invalid");
  }

  redirect(user.mustChangePassword ? "/account?password=required" : "/");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}
