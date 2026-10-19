import { sanitizeSettings } from './settings-sanitizer';

describe('sanitizeSettings', () => {
  it('garde les champs connus et du bon type', () => {
    expect(
      sanitizeSettings({ baseUrl: 'https://j', useDevProxy: true, planningHistoryDays: '28', inconnu: 1 }),
    ).toEqual({ baseUrl: 'https://j', useDevProxy: true });
  });

  it('rejette une source de données inconnue et les valeurs non objet', () => {
    expect(sanitizeSettings({ dataSource: 'gitlab' })).toEqual({});
    expect(sanitizeSettings(null)).toEqual({});
    expect(sanitizeSettings('texte')).toEqual({});
  });
});
