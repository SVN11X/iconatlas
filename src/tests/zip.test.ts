import { unzipSync, strFromU8 } from 'fflate';
import { buildZip, zipFolder } from '../services/export/zip';
import { makeCollection, makeIcon } from './fixtures';

describe('exportación ZIP', () => {
  it('organiza por proveedor/colección e incluye licencias', () => {
    const sap = makeCollection({ id: 'sap-btp', name: 'SAP BTP', provider: 'sap', attribution: '© SAP SE — Apache-2.0' });
    const lucide = makeCollection({ id: 'lucide', name: 'Lucide' });
    const zip = buildZip([
      { icon: makeIcon({ name: 'sap-hana-cloud', collection: sap, provider: 'sap' }), svg: '<svg/>' },
      { icon: makeIcon({ name: 'home', collection: lucide }), svg: '<svg/>', png: new Uint8Array([1, 2, 3]) },
      { icon: makeIcon({ name: 'microsoft-azure', provider: 'microsoft' }), svg: '<svg/>' },
    ]);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['LICENSES.txt', 'azure/microsoft-azure.svg', 'lucide/home.png', 'lucide/home.svg', 'sap/sap-hana-cloud.svg']);
    expect(strFromU8(files['LICENSES.txt'])).toContain('© SAP SE — Apache-2.0');
    expect(zipFolder(makeIcon({ provider: 'aws' }))).toBe('aws');
  });
});
