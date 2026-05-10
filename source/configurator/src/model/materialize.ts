import type { Action, ActionTemplate, IRCode, IRCodeId } from '@model/actions.ts';

export interface MaterializeResult {
    action: Action;
    newIRCode?: IRCode;
}

export function materialize(template: ActionTemplate, irCodes: IRCode[]): MaterializeResult {
    if (template.type === 'ir_send') {
        const existing = irCodes.find(
            c => c.protocol === template.protocol && c.code === template.code
        );

        if (existing) {
            return { action: irSendAction(existing.id) };
        }

        const newId: IRCodeId = irCodes.length > 0
            ? Math.max(...irCodes.map(c => c.id)) + 1
            : 1;

        return {
            action: irSendAction(newId),
            newIRCode: { id: newId, protocol: template.protocol, code: template.code },
        };
    }

    throw new Error(`Materialization for '${template.type}' is not yet supported`);
}

function irSendAction(id: IRCodeId): Action {
    return {
        type: 'ir_send',
        params: [id & 0xFF, (id >> 8) & 0xFF, 0, 0],
    };
}
