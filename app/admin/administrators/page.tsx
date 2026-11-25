import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  Empty,
  PageHead,
  Person,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { listAdministrators } from "@/lib/data/people";
import { AdminRowActions, GrantAccess } from "./forms";

export const metadata: Metadata = { title: "Administrators" };

export default async function AdministratorsPage() {
  const viewer = await requireSuperAdmin();
  const admins = await listAdministrators();

  const supers = admins.filter(
    (a) => a.admin_level === "super_admin" && a.account_status === "active",
  );

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Administrators"
        subtitle="Who can run the portal. Only a super admin sees this page, and every change here is recorded in the activity log."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title={`${admins.length} ${admins.length === 1 ? "person" : "people"}`}>
            <span className="flex-1" />
            <Chip tone="neutral">
              {supers.length} active super {supers.length === 1 ? "admin" : "admins"}
            </Chip>
          </CardHead>

          {admins.length === 0 ? (
            <CardBody>
              <Empty title="Nobody here yet">
                Give someone access with the form beside this list.
              </Empty>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Level</Th>
                  <Th>Account</Th>
                  <Th>Last change</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const isSelf = a.id === viewer.userId;
                  return (
                    <tr key={a.id} className={isSelf ? "bg-brand-50" : undefined}>
                      <Td>
                        <Person name={a.full_name} detail={a.email} />
                      </Td>
                      <Td>
                        {a.admin_level === "super_admin" ? (
                          <Chip tone="live">Super admin</Chip>
                        ) : (
                          <Chip tone="neutral">Admin</Chip>
                        )}
                      </Td>
                      <Td>
                        {a.account_status === "active" ? (
                          <Chip tone="present" dot>
                            Active
                          </Chip>
                        ) : (
                          <Chip tone="absent">
                            {a.account_status === "suspended" ? "Suspended" : "Inactive"}
                          </Chip>
                        )}
                      </Td>
                      <Td num className="whitespace-nowrap text-muted">
                        {new Date(a.updated_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                      <Td right>
                        <AdminRowActions
                          profileId={a.id}
                          level={a.admin_level}
                          isSelf={isSelf}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <CardFoot>
            <span className="text-sm text-muted">
              Removing access returns the person to being a student or professor. The
              last active super admin cannot be removed, so the university can never
              lock itself out.
            </span>
          </CardFoot>
        </Card>

        <Card tone="brand">
          <CardHead title="Give someone access" tone="brand" />
          <GrantAccess />
        </Card>
      </div>
    </>
  );
}
