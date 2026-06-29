import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
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
      await setDoc(doc(context.firestore(), "allowedEmails/partner@example.com"), { email: "partner@example.com" });
      await setDoc(doc(context.firestore(), "allowedEmails/other@example.com"), { email: "other@example.com" });
      await setDoc(doc(context.firestore(), "homes/ours"), { createdBy: "member", name: "Our home", memberEmails: ["member@example.com", "partner@example.com"] });
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

  it("lets both partners share chores but keeps other members out", async () => {
    const member = env.authenticatedContext("member", token("member@example.com")).firestore();
    const partner = env.authenticatedContext("partner", token("partner@example.com")).firestore();
    const other = env.authenticatedContext("other", token("other@example.com")).firestore();
    await assertSucceeds(setDoc(doc(member, "homes/ours/chores/dishes"), { title: "Do the dishes", scheduledDate: "2026-06-29", createdBy: "member" }));
    await assertSucceeds(getDoc(doc(partner, "homes/ours/chores/dishes")));
    await assertFails(getDoc(doc(other, "homes/ours/chores/dishes")));
  });

  it("allows a member to discover only homes containing their email", async () => {
    const member = env.authenticatedContext("member", token("member@example.com")).firestore();
    await assertSucceeds(getDocs(query(collection(member, "homes"), where("memberEmails", "array-contains", "member@example.com"))));
  });

  it("requires a new two-person home to include its creator", async () => {
    const member = env.authenticatedContext("member", token("member@example.com")).firestore();
    await assertSucceeds(setDoc(doc(member, "homes/new-home"), { createdBy: "member", name: "Our home", memberEmails: ["member@example.com", "partner@example.com"] }));
    await assertFails(setDoc(doc(member, "homes/not-mine"), { createdBy: "member", name: "Nope", memberEmails: ["partner@example.com", "other@example.com"] }));
  });
});
