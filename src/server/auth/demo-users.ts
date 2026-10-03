import type { User } from "../domain/pass-request";
import type { UserDirectory } from "../ports";

/**
 * Stand-in for the university's identity provider. The role switcher signs in as one of
 * these accounts; the role always comes from this directory, never from the browser.
 * All names are fictional.
 */
export const DEMO_USERS: readonly User[] = [
  { id: "visitor-1", name: "Demo Visitor", role: "visitor" },
  { id: "host-moreno", name: "Dr. Alicia Moreno", role: "host", department: "Computer Science" },
  { id: "host-carter", name: "Prof. Ben Carter", role: "host", department: "Business Administration" },
  { id: "host-li", name: "Ms. Chen Li", role: "host", department: "Admissions Office" },
  { id: "guard-gate-a", name: "Gate A Guard", role: "guard" },
];

export function createUserDirectory(users: readonly User[] = DEMO_USERS): UserDirectory {
  return {
    findById: (id) => users.find((user) => user.id === id),
    list: () => [...users],
  };
}
