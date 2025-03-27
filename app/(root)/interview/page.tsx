import Agent from "@/components/Agent";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import React from "react";

export default async function page() {
  const user = await getCurrentUser();
  return (
    <>
      <h3>Interview Generation</h3>
      <Agent userName={user?.name} userId={user?.id} type="generate" />
    </>
  );
}
