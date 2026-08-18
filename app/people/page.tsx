import { PeopleImport } from "@/components/PeopleImport";
import { ActionForm } from "@/components/ActionForm";
import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/auth";
import {
  createPersonAction,
  mergePeopleAction,
  updatePersonAction,
} from "@/lib/people-attendance-actions";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { personStatusLabels, personTypeLabels } from "@/lib/ui-labels";
import { containsText, stringList } from "@/lib/database-compat";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    page?: string;
    personId?: string;
  }>;
}) {
  const user = await requirePermission("people.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const take = 25;
  const query = params.q?.trim() ?? "";
  const where: Prisma.PersonWhereInput = {
    churchId: user.churchId,
    ...(params.type === "MEMBER" || params.type === "VISITOR"
      ? { personType: params.type as "MEMBER" | "VISITOR" }
      : {}),
    ...(["ACTIVE", "INACTIVE", "FOLLOW_UP"].includes(params.status ?? "")
      ? { status: params.status as "ACTIVE" | "INACTIVE" | "FOLLOW_UP" }
      : {}),
    ...(query
      ? {
          OR: [
            { firstName: containsText(query) },
            { lastName: containsText(query) },
            { email: containsText(query) },
            { phone: { contains: query } },
          ],
        }
      : {}),
  };
  const [people, total] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * take,
      take,
    }),
    prisma.person.count({ where }),
  ]);
  const selected = params.personId
    ? await prisma.person.findFirst({
        where: { id: params.personId, churchId: user.churchId },
        include: {
          attendance: {
            include: { session: true },
            orderBy: { checkedInAt: "desc" },
            take: 20,
          },
        },
      })
    : null;
  const allPeople = await prisma.person.findMany({
    where: { churchId: user.churchId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  const filterQuery = new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(params.status ? { status: params.status } : {}),
  });
  return (
    <>
      <PageHeader
        title="Personas"
        subtitle="Busca, actualiza e importa personas, y consulta su historial de asistencia."
        actions={
          <>
            <a className="button" href="/api/people/export">
              Exportar CSV
            </a>
            <a className="button primary" href="#quick-add">
              Agregar persona
            </a>
          </>
        }
      />
      <section className="content grid">
        <form className="panel filter-bar">
          <input
            aria-label="Buscar personas"
            name="q"
            defaultValue={query}
            placeholder="Buscar nombre, correo o teléfono"
          />
          <select
            aria-label="Filtrar por tipo"
            name="type"
            defaultValue={params.type ?? ""}
          >
            <option value="">Todos los tipos</option>
            <option value="MEMBER">Miembro</option>
            <option value="VISITOR">Visitante</option>
          </select>
          <select
            aria-label="Filtrar por estado"
            name="status"
            defaultValue={params.status ?? ""}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="FOLLOW_UP">Seguimiento</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
          <button className="button">Filtrar</button>
        </form>
        <div className="grid people-layout">
          <div className="panel table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Contacto</th>
                  <th>Etiquetas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <strong>
                        {person.firstName} {person.lastName}
                      </strong>
                      <div className="muted">{person.familyNotes}</div>
                    </td>
                    <td>{personTypeLabels[person.personType]}</td>
                    <td>{personStatusLabels[person.status]}</td>
                    <td>
                      {person.email}
                      <div className="muted">{person.phone}</div>
                    </td>
                    <td>{stringList(person.tags).join(", ")}</td>
                    <td>
                      <a
                        className="button"
                        href={`/people?${filterQuery}&personId=${person.id}`}
                      >
                        Abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pagination">
              <span>{total} personas</span>
              {page > 1 ? (
                <a
                  className="button"
                  href={`/people?${filterQuery}&page=${page - 1}`}
                >
                  Anterior
                </a>
              ) : null}
              {page * take < total ? (
                <a
                  className="button"
                  href={`/people?${filterQuery}&page=${page + 1}`}
                >
                  Siguiente
                </a>
              ) : null}
            </div>
          </div>
          <aside className="grid">
            {selected ? (
              <ActionForm
                action={updatePersonAction}
                className="panel form-grid"
                successMessage="La persona se actualizó correctamente."
              >
                <h2>Editar persona</h2>
                <input type="hidden" name="personId" value={selected.id} />
                <div className="grid two">
                  <div className="field">
                    <label>
                      Nombre
                      <input
                        maxLength={80}
                        name="firstName"
                        defaultValue={selected.firstName}
                        required
                      />
                    </label>
                  </div>
                  <div className="field">
                    <label>
                      Apellido
                      <input
                        maxLength={80}
                        name="lastName"
                        defaultValue={selected.lastName}
                        required
                      />
                    </label>
                  </div>
                </div>
                <div className="field">
                  <label>
                    Email
                    <input
                      autoComplete="email"
                      maxLength={254}
                      name="email"
                      defaultValue={selected.email ?? ""}
                      type="email"
                    />
                  </label>
                </div>
                <div className="field">
                  <label>
                    Teléfono
                    <input
                      autoComplete="tel"
                      maxLength={30}
                      name="phone"
                      defaultValue={selected.phone ?? ""}
                      type="tel"
                    />
                  </label>
                </div>
                <div className="grid two">
                  <select
                    aria-label="Tipo de persona"
                    name="personType"
                    defaultValue={selected.personType}
                  >
                    <option value="MEMBER">Miembro</option>
                    <option value="VISITOR">Visitante</option>
                  </select>
                  <select
                    aria-label="Estado de la persona"
                    name="status"
                    defaultValue={selected.status}
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="FOLLOW_UP">Seguimiento</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    Notas familiares
                    <textarea
                      maxLength={2000}
                      name="familyNotes"
                      defaultValue={selected.familyNotes ?? ""}
                    />
                  </label>
                </div>
                <div className="field">
                  <label>
                    Etiquetas
                    <input
                      maxLength={500}
                      name="tags"
                      defaultValue={stringList(selected.tags).join(", ")}
                    />
                  </label>
                </div>
                <button className="button primary" type="submit">
                  Guardar persona
                </button>
                <h3>Asistencia reciente</h3>
                {selected.attendance.map((record) => (
                  <p className="muted" key={record.id}>
                    {record.session.title} ·{" "}
                    {record.checkedInAt.toLocaleDateString()}
                  </p>
                ))}
              </ActionForm>
            ) : (
              <ActionForm
                action={createPersonAction}
                className="panel form-grid"
                id="quick-add"
                successMessage="La persona se creó correctamente."
              >
                <h2>Registro rápido</h2>
                <div className="field">
                  <label>
                    Nombre completo
                    <input
                      autoComplete="name"
                      maxLength={160}
                      minLength={2}
                      name="name"
                      required
                    />
                  </label>
                </div>
                <select
                  aria-label="Tipo de persona"
                  name="type"
                  defaultValue="VISITOR"
                >
                  <option value="MEMBER">Miembro</option>
                  <option value="VISITOR">Visitante</option>
                </select>
                <div className="field">
                  <label>
                    Correo o teléfono
                    <input
                      autoComplete="email tel"
                      maxLength={254}
                      name="contact"
                    />
                  </label>
                </div>
                <button className="button primary" type="submit">
                  Crear persona
                </button>
              </ActionForm>
            )}
            <ActionForm
              action={mergePeopleAction}
              className="panel form-grid"
              confirmMessage="Esta acción combinará la asistencia y eliminará el registro duplicado. ¿Deseas continuar?"
              successMessage="Las personas se combinaron correctamente."
            >
              <h2>Combinar duplicados</h2>
              <select
                aria-label="Persona que se conservará"
                name="targetId"
                required
              >
                <option value="">Conservar persona... </option>
                {allPeople.map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
              <select
                aria-label="Persona duplicada que se retirará"
                name="sourceId"
                required
              >
                <option value="">Combinar y retirar... </option>
                {allPeople.map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
              <button className="button danger" type="submit">
                Confirmar combinación
              </button>
            </ActionForm>
            <PeopleImport />
          </aside>
        </div>
      </section>
    </>
  );
}
