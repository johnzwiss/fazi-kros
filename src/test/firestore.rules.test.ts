import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
const OWNER_UID = "owner-test-uid";

describe("Firestore privacy rules", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "training-plan-tracker-test",
      firestore: { rules: readFileSync("firestore.rules", "utf8") },
    });
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `admins/${OWNER_UID}`), { role: "owner" });
      await setDoc(doc(context.firestore(), "allowedEmails/member@example.com"), { email: "member@example.com" });
    });
  });
  afterAll(async () => env.cleanup());

  const token = (email: string) => ({ email, email_verified: true });

  it("allows the owner to publish templates", async () => {
    const owner = env.authenticatedContext(OWNER_UID, token("owner@example.com")).firestore();
    await assertSucceeds(setDoc(doc(owner, "templates/plan"), { title: "Plan" }));
  });

  it("allows invited members to read templates but not publish", async () => {
    const member = env.authenticatedContext("member", token("member@example.com")).firestore();
    await assertSucceeds(getDoc(doc(member, "templates/plan")));
    await assertFails(setDoc(doc(member, "templates/plan"), { title: "Nope" }));
  });

  it("prevents cross-user training reads, including by the owner", async () => {
    const member = env.authenticatedContext("member", token("member@example.com")).firestore();
    const other = env.authenticatedContext(OWNER_UID, token("owner@example.com")).firestore();
    await assertSucceeds(setDoc(doc(member, "users/member/plans/one"), { title: "Private" }));
    await assertFails(getDoc(doc(other, "users/member/plans/one")));
  });

  it("prevents members from granting themselves owner access", async () => {
    const member = env.authenticatedContext("member", token("member@example.com")).firestore();
    await assertFails(setDoc(doc(member, "admins/member"), { role: "owner" }));
  });

  it("rejects uninvited accounts", async () => {
    const stranger = env.authenticatedContext("stranger", token("stranger@example.com")).firestore();
    await assertFails(getDoc(doc(stranger, "templates/plan")));
  });
});
