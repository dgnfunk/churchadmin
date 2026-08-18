"use client";

import { Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { saveMinistryMembershipsAction } from "@/lib/ministry-actions";

type MembershipPerson = {
  id: string;
  name: string;
  contact: string;
  assignedRoleIds: string[];
};

type MembershipRole = {
  id: string;
  name: string;
  description: string;
  color: string;
  isOfferingRole: boolean;
};

export function MinistryMembershipEditor({ people, roles }: { people: MembershipPerson[]; roles: MembershipRole[] }) {
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id ?? "");
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
  const filteredPeople = useMemo(() => people.filter((person) => `${person.name} ${person.contact}`.toLocaleLowerCase("es-MX").includes(normalizedQuery)), [normalizedQuery, people]);
  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? people[0];

  if (!people.length) return <div className="page-empty"><UserRound /><h2>No hay miembros disponibles</h2><p>Agrega miembros activos para poder asignarles cargos ministeriales.</p></div>;

  return <div className="membership-manager">
    <aside aria-label="Miembros" className="member-picker">
      <div className="member-picker-heading"><div><span className="eyebrow">Miembros</span><h2>Selecciona una persona</h2></div><span className="status-badge">{people.length}</span></div>
      <label className="member-search"><span>Buscar miembro</span><div><Search /><input onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o teléfono" type="search" value={query} /></div></label>
      <div className="member-picker-list">
        {filteredPeople.length ? filteredPeople.map((person) => {
          const active = person.id === selectedPerson?.id;
          return <button aria-pressed={active} className={active ? "member-picker-item active" : "member-picker-item"} key={person.id} onClick={() => setSelectedPersonId(person.id)} type="button"><span className="member-avatar" aria-hidden="true">{initials(person.name)}</span><span><strong>{person.name}</strong><small>{person.contact}</small></span><span className="member-role-count">{person.assignedRoleIds.length}</span></button>;
        }) : <p className="member-picker-empty">No encontramos miembros con esa búsqueda.</p>}
      </div>
    </aside>

    <section aria-live="polite" className="member-role-editor">
      {selectedPerson ? <MembershipForm key={`${selectedPerson.id}:${[...selectedPerson.assignedRoleIds].sort().join("|")}`} person={selectedPerson} roles={roles} /> : null}
    </section>
  </div>;
}

function MembershipForm({ person, roles }: { person: MembershipPerson; roles: MembershipRole[] }) {
  const assignmentSignature = [...person.assignedRoleIds].sort().join("|");
  const [selectedRoleIds, setSelectedRoleIds] = useState(() => new Set(person.assignedRoleIds));
  const initialRoleIds = new Set(person.assignedRoleIds);
  const dirty = assignmentSignature !== [...selectedRoleIds].sort().join("|");
  const groups = [
    { title: "Ministerios", description: "Áreas en las que esta persona está preparada para servir.", roles: roles.filter((role) => !role.isOfferingRole) },
    { title: "Ofrendas y finanzas", description: "Accesos sensibles para captura o auditoría de ofrendas.", roles: roles.filter((role) => role.isOfferingRole) },
  ].filter((group) => group.roles.length);

  const toggleRole = (roleId: string) => setSelectedRoleIds((current) => {
    const next = new Set(current);
    if (next.has(roleId)) next.delete(roleId); else next.add(roleId);
    return next;
  });

  return <ActionForm action={saveMinistryMembershipsAction} className="membership-editor-form" successMessage="Los cargos del miembro se actualizaron correctamente.">
    <input name="personId" type="hidden" value={person.id} />
    <header className="member-editor-heading"><div><span className="eyebrow">Cargos asignados</span><h2>{person.name}</h2><p>{person.contact}</p></div><span className="assignment-count"><strong>{selectedRoleIds.size}</strong><span>{selectedRoleIds.size === 1 ? "cargo" : "cargos"}</span></span></header>

    {groups.length ? <div className="membership-role-groups">{groups.map((group) => <fieldset className="membership-role-group" key={group.title}><legend>{group.title}</legend><p>{group.description}</p><div className="membership-role-list">{group.roles.map((role) => {
      const checked = selectedRoleIds.has(role.id);
      return <label className={checked ? "membership-role-option selected" : "membership-role-option"} key={role.id}><input checked={checked} name="ministryRoleIds" onChange={() => toggleRole(role.id)} type="checkbox" value={role.id} /><span className="ministry-color" style={{ backgroundColor: role.color }} /><span><strong>{role.name}</strong><small>{role.description}</small></span><span className="role-selection-state">{checked ? "Asignado" : "Sin asignar"}</span></label>;
    })}</div></fieldset>)}</div> : <div className="page-empty compact"><h3>No hay cargos activos</h3><p>Crea o activa un cargo antes de asignarlo.</p></div>}

    <footer className="membership-editor-footer"><span>{dirty ? "Tienes cambios sin guardar." : "Todos los cambios están guardados."}</span><div className="actions"><button className="button" disabled={!dirty} onClick={() => setSelectedRoleIds(new Set(initialRoleIds))} type="button">Cancelar</button><button className="button primary" disabled={!dirty} type="submit">Guardar cambios</button></div></footer>
  </ActionForm>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es-MX");
}
