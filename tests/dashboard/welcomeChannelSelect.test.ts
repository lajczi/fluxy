import { buildWelcomeChannelSelectData } from '../../dashboard/src/lib/welcomeChannelSelect';

describe('buildWelcomeChannelSelectData', () => {
  test('includes uncategorized channels and category children in expected order', () => {
    const result = buildWelcomeChannelSelectData([
      { id: 'cat-main', name: 'main', type: 4, parent_id: null, position: 2 },
      { id: 'announce', name: 'announcements', type: 5, parent_id: null, position: 0 },
      { id: 'welcome', name: 'welcome', type: 0, parent_id: null, position: 1 },
      { id: 'rules', name: 'rules', type: 0, parent_id: 'cat-main', position: 0 },
      { id: 'general', name: 'general', type: 0, parent_id: 'cat-main', position: 1 },
      { id: 'voice', name: 'voice', type: 2, parent_id: 'cat-main', position: 2 },
    ]);

    expect(result.options).toEqual([
      { id: 'announce', label: '# announcements', isCategory: false },
      { id: 'welcome', label: '# welcome', isCategory: false },
      { id: 'cat-main', label: 'MAIN', isCategory: true },
      { id: 'rules', label: '  # rules', isCategory: false },
      { id: 'general', label: '  # general', isCategory: false },
    ]);

    expect(result.selectableIds).toEqual(['announce', 'welcome', 'rules', 'general']);
  });

  test('supports parentId fallback when parent_id is not present', () => {
    const result = buildWelcomeChannelSelectData([
      { id: 'cat', name: 'tickets', type: 4, parent_id: null, position: 0 },
      { id: 'queue', name: 'queue', type: 0, parent_id: null, parentId: 'cat', position: 0 } as any,
    ]);

    expect(result.options).toEqual([
      { id: 'cat', label: 'TICKETS', isCategory: true },
      { id: 'queue', label: '  # queue', isCategory: false },
    ]);
    expect(result.selectableIds).toEqual(['queue']);
  });

  test('includes Fluxer extended link channels and still excludes voice/category channels', () => {
    const result = buildWelcomeChannelSelectData([
      { id: 'cat', name: 'news', type: 4, parent_id: null, position: 0 },
      { id: 'announce', name: 'announcements', type: 998, parent_id: null, position: 1 } as any,
      { id: 'voice', name: 'voice', type: 2, parent_id: null, position: 2 },
    ]);

    expect(result.options).toEqual([
      { id: 'announce', label: '# announcements', isCategory: false },
      { id: 'cat', label: 'NEWS', isCategory: true },
    ]);
    expect(result.selectableIds).toEqual(['announce']);
  });
});
