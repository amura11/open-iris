export type Selection =
    | { type: 'screen' }
    | { type: 'button'; buttonCode: string }
    | null;
