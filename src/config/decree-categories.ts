export interface DecreeIssuer {
    value: string;
    label: string;
    roleId: string;
}

export const DECREE_ISSUERS: DecreeIssuer[] = [
    {
        value: 'project',
        label: 'Руководитель проекта',
        roleId: '1262857260762136626',
    },
    {
        value: 'admin',
        label: 'Главный администратор',
        roleId: '1262342579513593912',
    },
    {
        value: 'chief_staff',
        label: 'Начальник Штаба',
        roleId: '1262342579492618276',
    },
    {
        value: 'odkb',
        label: 'Дивизионный Лидер ОДКБ',
        roleId: '1333886513204826143',
    },
    {
        value: 'spec',
        label: 'Командир роты специалистов',
        roleId: '1262342579492618270',
    },
    {
        value: 'sturm',
        label: 'Командир штурмовой роты',
        roleId: '1262342579492618271',
    },
    {
        value: 'vvs',
        label: 'Начальник службы ВВС',
        roleId: '1271376725313585153',
    },
    {
        value: 'btv',
        label: 'Начальник службы БТВ',
        roleId: '1400995841946419231',
    },
    {
        value: 'vp',
        label: 'Начальник Военной Полиции',
        roleId: '1270006755904065596',
    },
    {
        value: 'gru',
        label: 'Командир ГРУ',
        roleId: '1369386542644334663',
    },
    {
        value: 'povst',
        label: 'Командир Повстанцев',
        roleId: '1405203366824509450',
    },
    {
        value: 'leg',
        label: 'Начальник Легионеров',
        roleId: '1523219020973604885',
    },
    {
        value: 'eaa',
        label: 'Командир ЕАА',
        roleId: '1262342579492618273',
    },
];

export const DECREE_SUBJECTS = [
    {
        value: 'position',
        label: 'О положении',
    },
    {
        value: 'appointment',
        label: 'О назначении',
    },
];