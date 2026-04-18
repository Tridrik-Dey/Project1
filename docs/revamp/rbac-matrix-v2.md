# RBAC Matrix V2 (Freeze)

## Roles

- `SUPER_ADMIN`
- `RESPONSABILE_ALBO`
- `REVISORE`
- `VIEWER`
- `SUPPLIER`

Admin users can hold multiple admin roles.

## Permissions Matrix (Action-Level)

| Action | SUPER_ADMIN | RESPONSABILE_ALBO | REVISORE | VIEWER | SUPPLIER |
|---|---|---|---|---|---|
| Manage admin users/roles | Y | N | N | N | N |
| Configure lifecycle/notifications | Y | N | N | N | N |
| Create/renew/cancel invite | Y | Y | N | N | N |
| View pending queue | Y | Y | Y | N | N |
| Assign review case | Y | Y | N | N | N |
| Request integration | Y | Y | Y | N | N |
| Approve/Reject application | Y | Y | N | N | N |
| Suspend/Reactivate profile | Y | Y | N | N | N |
| Hard delete profile | Y | N | N | N | N |
| Add internal admin note | Y | Y | Y | N | N |
| View internal admin note | Y | Y | Y | N | N |
| Submit supplier evaluation | Y | Y | Y | N | N |
| Annul evaluation | Y | N | N | N | N |
| View reports/exports | Y | Y | Y | Y (limited) | N |
| View active supplier profiles | Y | Y | Y | Y | own only |
| Edit own draft application | N | N | N | N | Y |
| Submit own application/renewal | N | N | N | N | Y |
| View own review outcome/comms | N | N | N | N | Y |

## Data Visibility Rules

1. `VIEWER`
- Can read active supplier cards and high-level scores.
- Cannot access internal notes, full documents, sensitive fields.

2. `REVISORE`
- Can access review-required data and documents.
- Cannot perform final approve/reject.

3. `RESPONSABILE_ALBO`
- Full review and decision scope.

4. `SUPER_ADMIN`
- Full system scope including deletion, role management, config.

5. `SUPPLIER`
- Own profile/application data only.

## Sensitive Field Policy

Sensitive fields include personal identifiers, fiscal/legal declarations, and potentially banking data.

- Read access must be explicitly granted by role.
- Access attempts must be auditable.

