"""Generate docs/database-schema.md from the SQLAlchemy models (the source of truth).

    python -m app.db.schema_doc > docs/database-schema.md
"""

import app.db.models  # noqa: F401
from app.db.base import Base


def render() -> str:
    out = ["# Database schema", "",
           "Generated from the models by `python -m app.db.schema_doc`; do not edit by hand. "
           "Postgres 17 (Supabase). Row Level Security is on for every table with no policies: only the backend "
           "(database owner) can read or write. Enums are `text` plus a CHECK constraint.", "",
           f"{len(Base.metadata.tables)} tables.", ""]
    for name in sorted(Base.metadata.tables):
        t = Base.metadata.tables[name]
        out += [f"## {name}", "", "| column | type | null | notes |", "|---|---|---|---|"]
        fks = {c.parent.name: c.column.table.name + "." + c.column.name for c in t.foreign_keys}
        pks = {c.name for c in t.primary_key.columns}
        for c in t.columns:
            notes = []
            if c.name in pks:
                notes.append("PK")
            if c.name in fks:
                notes.append("FK " + fks[c.name])
            if c.unique:
                notes.append("unique")
            out.append(f"| {c.name} | {str(c.type).lower()} | {'yes' if c.nullable else 'no'} | {', '.join(notes)} |")
        checks = [str(c.sqltext) for c in t.constraints if c.__class__.__name__ == "CheckConstraint"]
        if checks:
            out += ["", "Checks: " + "; ".join(f"`{c}`" for c in checks)]
        out.append("")
    return "\n".join(out)


if __name__ == "__main__":
    print(render())
