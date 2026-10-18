import { createEngine, expandQuery, tokenize, type SearchDoc } from '../services/search/engine';
import synonyms from '../catalog/schemas/synonyms.json';

const docs: SearchDoc[] = [
  { id: 0, title: 'Azure Virtual Machines', name: 'azure virtual machines', tags: '', coll: 'Azure Architecture Icons', prov: 'Microsoft', cat: 'Cómputo Compute', priority: 0 },
  { id: 1, title: 'Compute Engine', name: 'compute engine', tags: 'Compute', coll: 'Google Cloud Icons', prov: 'Google Cloud', cat: 'Cómputo Compute', priority: 0 },
  { id: 2, title: 'Amazon EC2', name: 'amazon ec2', tags: 'elastic compute cloud|ec2', coll: 'AWS', prov: 'Amazon Web Services AWS', cat: 'Cómputo Compute', priority: 0 },
  { id: 3, title: 'Azure Cosmos DB', name: 'azure cosmos db', tags: 'Databases', coll: 'Azure Architecture Icons', prov: 'Microsoft', cat: 'Bases de datos Databases', priority: 0 },
  { id: 4, title: 'Database', name: 'database', tags: '', coll: 'Lucide', prov: '', cat: 'Bases de datos Databases', priority: 3 },
  { id: 5, title: 'Microsoft Entra ID', name: 'microsoft entra id', tags: 'azure ad|entra', coll: 'Microsoft products', prov: 'Microsoft', cat: 'Seguridad Security', priority: 0 },
  { id: 6, title: 'Kubernetes', name: 'kubernetes', tags: '', coll: 'Devicon', prov: '', cat: 'Contenedores Containers', priority: 2 },
  { id: 7, title: 'Azure Data Factory', name: 'azure data factory', tags: '', coll: 'Azure Architecture Icons', prov: 'Microsoft', cat: 'Datos Analytics', priority: 0 },
];

describe('motor de búsqueda', () => {
  const engine = createEngine(docs, synonyms.groups);

  it('encuentra por nombre exacto en primer lugar', () => {
    expect(engine.search('azure data factory')[0]).toBe(7);
  });
  it('«virtual machine» encuentra máquinas virtuales de varios proveedores', () => {
    const r = engine.search('virtual machine');
    expect(r).toEqual(expect.arrayContaining([0, 1, 2]));
  });
  it('«vm» se expande con sinónimos', () => {
    expect(engine.search('vm')).toEqual(expect.arrayContaining([0, 1, 2]));
  });
  it('«base de datos» equivale a «database»', () => {
    const r = engine.search('base de datos');
    expect(r).toEqual(expect.arrayContaining([3, 4]));
  });
  it('«entra» encuentra Microsoft Entra', () => {
    expect(engine.search('entra')[0]).toBe(5);
  });
  it('tolera errores tipográficos', () => {
    expect(engine.search('kubernets')).toContain(6);
  });
  it('autocompletado', () => {
    expect(engine.suggest('kube').length).toBeGreaterThan(0);
  });
  it('expansión y tokenización', () => {
    expect(tokenize('Máquina Virtual')).toEqual(['maquina', 'virtual']);
    expect(expandQuery('vm', synonyms.groups)).toContain('virtual machine');
  });
});
