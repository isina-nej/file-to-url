/**
 * @file Unit Tests: Technical and Science Metadata Extraction
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMediaMetadata } from '../../tgcloud/lib/metadata.js';

test('extractMediaMetadata: identifies PDB biological macromolecule structures', () => {
  const parsedMedia = {
    fileName: '4hhb_hemoglobin.pdb',
    fileExtension: 'pdb',
  };

  const { mediaMetadataJson, scienceBadge } = extractMediaMetadata(parsedMedia);
  assert.ok(mediaMetadataJson);
  const parsed = JSON.parse(mediaMetadataJson);
  assert.equal(parsed.scienceType, 'MACROMOLECULAR_STRUCTURE');
  assert.equal(parsed.predictedPdbId, '4HHB');
  assert.equal(parsed.rcsbPdbUrl, 'https://www.rcsb.org/structure/4HHB');
  assert.ok(scienceBadge.includes('4HHB'));
});

test('extractMediaMetadata: identifies FASTA sequence files', () => {
  const parsedMedia = {
    fileName: 'human_tp53_protein.fasta',
    fileExtension: 'fasta',
  };

  const { mediaMetadataJson, scienceBadge } = extractMediaMetadata(parsedMedia);
  const parsed = JSON.parse(mediaMetadataJson);
  assert.equal(parsed.scienceType, 'GENOMIC_OR_PROTEIN_SEQUENCE');
  assert.equal(parsed.scienceFormat, 'FASTA');
  assert.ok(scienceBadge.includes('FASTA'));
});

test('extractMediaMetadata: identifies chemical SDF files', () => {
  const parsedMedia = {
    fileName: 'imatinib_ligand.sdf',
    fileExtension: 'sdf',
  };

  const { mediaMetadataJson, scienceBadge } = extractMediaMetadata(parsedMedia);
  const parsed = JSON.parse(mediaMetadataJson);
  assert.equal(parsed.scienceType, 'CHEMICAL_COMPOUND');
  assert.equal(parsed.scienceFormat, 'SDF');
  assert.ok(scienceBadge.includes('SDF'));
});

test('extractMediaMetadata: identifies PubMed PMID literature references', () => {
  const parsedMedia = {
    fileName: 'research_paper_pmid_12345678.pdf',
    fileExtension: 'pdf',
  };

  const { mediaMetadataJson, scienceBadge } = extractMediaMetadata(parsedMedia);
  const parsed = JSON.parse(mediaMetadataJson);
  assert.equal(parsed.scienceType, 'BIOMEDICAL_LITERATURE');
  assert.equal(parsed.pmid, '12345678');
  assert.equal(parsed.pubmedUrl, 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
  assert.ok(scienceBadge.includes('12345678'));
});
