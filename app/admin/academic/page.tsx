import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardFoot,
  CardHead,
  Chip,
  PageHead,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import {
  listAcademicLevels,
  listIntakeBatches,
  listTerms,
} from "@/lib/data/academic";
import { AddBatch, AddLevel, AddTerm, ActivateTermButton, RetireButton } from "./forms";

export const metadata: Metadata = { title: "Batches, levels and terms" };

const TERM_TONE = {
  active: "open",
  planning: "ghost",
  completed: "neutral",
  archived: "neutral",
} as const;

const TERM_LABEL = {
  active: "Active",
  planning: "Being planned",
  completed: "Finished",
  archived: "Archived",
} as const;

export default async function AcademicPage() {
  const supabase = await createClient();

  const [batches, levels, terms, students] = await Promise.all([
    listIntakeBatches(),
    listAcademicLevels(),
    listTerms(),
    supabase.from("students").select("id, intake_batch_id, academic_level_id, student_id"),
  ]);

  const rows = students.data ?? [];
  const perBatch = new Map<string, number>();
  const perLevel = new Map<string, number>();
  for (const s of rows) {
    if (s.intake_batch_id)
      perBatch.set(s.intake_batch_id, (perBatch.get(s.intake_batch_id) ?? 0) + 1);
    if (s.academic_level_id)
      perLevel.set(s.academic_level_id, (perLevel.get(s.academic_level_id) ?? 0) + 1);
  }

  // Student numbers are seven digits: the last two of the year they joined,
  // then a running number. Work out where each year has got to.
  const byYear = new Map<string, number>();
  for (const s of rows) {
    const match = /^(\d{2})(\d{5})$/.exec(s.student_id);
    if (!match) continue;
    const [, prefix, seq] = match;
    byYear.set(prefix, Math.max(byYear.get(prefix) ?? 0, Number(seq)));
  }
  const numbering = [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([prefix, highest]) => ({
      year: `20${prefix}`,
      prefix,
      issued: highest,
      next: `${prefix}${String(highest + 1).padStart(5, "0")}`,
    }));

  const nextSequence = Math.max(0, ...levels.map((l) => l.sequence_number)) + 1;

  return (
    <>
      <PageHead
        crumbs={<Link href="/admin">Overview</Link>}
        title="Batches, levels and terms"
        subtitle="Everything else is built on these three lists. None of them can be deleted — historical records point at them, so they are retired instead."
      />

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Intake batches" />
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Semester</Th>
                <Th right>Year</Th>
                <Th right>Numbers</Th>
                <Th right>Students</Th>
                <Th>At registration</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className={b.is_active ? undefined : "bg-[#fafbfc]"}>
                  <Td num>
                    <b>{b.name}</b>
                  </Td>
                  <Td className="text-muted">{b.semester}</Td>
                  <Td right num>
                    {b.start_year}
                  </Td>
                  <Td right num className="text-muted">
                    {String(b.start_year).slice(-2)}…
                  </Td>
                  <Td right num>
                    {perBatch.get(b.id) ?? 0}
                  </Td>
                  <Td>
                    {b.is_active ? (
                      <Chip tone="present" dot>
                        Shown
                      </Chip>
                    ) : (
                      <Chip tone="ghost">Retired</Chip>
                    )}
                  </Td>
                  <Td right>
                    <RetireButton table="intake_batches" id={b.id} isActive={b.is_active} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <CardFoot>
            <span className="text-sm text-muted">
              A retired batch disappears from the registration form but stays on every
              record that uses it.
            </span>
          </CardFoot>
        </Card>

        <Card tone="brand">
          <CardHead title="Add an intake batch" tone="brand" />
          <AddBatch />
        </Card>
      </div>

      <div className="mb-5 grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="Academic levels" />
          <Table>
            <thead>
              <tr>
                <Th right>Order</Th>
                <Th>Name</Th>
                <Th right>Students</Th>
                <Th>In use</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.id} className={l.is_active ? undefined : "bg-[#fafbfc]"}>
                  <Td right num>
                    {l.sequence_number}
                  </Td>
                  <Td>
                    <b>{l.name}</b>
                  </Td>
                  <Td right num>
                    {perLevel.get(l.id) ?? 0}
                  </Td>
                  <Td>
                    {l.is_active ? (
                      <Chip tone="present" dot>
                        Yes
                      </Chip>
                    ) : (
                      <Chip tone="ghost">Retired</Chip>
                    )}
                  </Td>
                  <Td right>
                    <RetireButton table="academic_levels" id={l.id} isActive={l.is_active} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <AddLevel nextSequence={nextSequence} />
        </Card>

        <Card>
          <CardHead title="Academic terms" />
          <Table>
            <thead>
              <tr>
                <Th>Term</Th>
                <Th>Runs</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className={t.status === "active" ? "bg-brand-50" : undefined}>
                  <Td>
                    <b>{t.name}</b>
                  </Td>
                  <Td num className="text-muted">
                    {new Date(t.start_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    –{" "}
                    {new Date(t.end_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td>
                    <Chip tone={TERM_TONE[t.status]}>{TERM_LABEL[t.status]}</Chip>
                  </Td>
                  <Td right>
                    {t.status !== "active" && t.status !== "archived" && (
                      <ActivateTermButton id={t.id} />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <CardFoot>
            <span className="text-sm text-muted">
              Only one term is active at a time. Making another active marks the current
              one finished.
            </span>
          </CardFoot>
        </Card>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card tone="brand">
          <CardHead title="Add a term" tone="brand" />
          <AddTerm />
        </Card>

        <Card>
          <CardHead title="Student numbers">
            <span className="flex-1" />
            <Chip tone="neutral">One scheme, whole university</Chip>
          </CardHead>
          <CardBody className="pb-0">
            <p className="text-sm text-muted">
              Seven digits: the last two of the year the student joined, then a running
              number issued in order of registration. The prefix moves on by itself each
              year.
            </p>
          </CardBody>
          {numbering.length === 0 ? (
            <CardBody>
              <p className="text-sm text-muted">
                No numbers issued yet. The first student to register in {new Date().getFullYear()}{" "}
                will be {String(new Date().getFullYear()).slice(-2)}00001.
              </p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th right>Year joined</Th>
                  <Th right>Issued</Th>
                  <Th right>Next</Th>
                </tr>
              </thead>
              <tbody>
                {numbering.map((n) => (
                  <tr key={n.prefix}>
                    <Td right num>
                      {n.year}
                    </Td>
                    <Td right num>
                      {n.issued}
                    </Td>
                    <Td right num>
                      <b>{n.next}</b>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
