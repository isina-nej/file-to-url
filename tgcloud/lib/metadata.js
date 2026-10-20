/**
 * @file Metadata Extraction Layer
 * @description Extracts technical and scientific metadata from Telegram media structures.
 * Integrates science detection (PDB structures, chemical molecules, FASTA sequences, PMIDs).
 */

export function extractMediaMetadata(parsedMedia) {
  if (!parsedMedia) return { mediaMetadataJson: null, scienceBadge: null };

  const meta = {};
  let scienceBadge = null;

  // Audio specific
  if (parsedMedia.rawMedia?.performer || parsedMedia.rawMedia?.title) {
    meta.performer = parsedMedia.rawMedia.performer || null;
    meta.title = parsedMedia.rawMedia.title || null;
  }

  // Visual specific
  if (parsedMedia.width && parsedMedia.height) {
    meta.resolution = `${parsedMedia.width}x${parsedMedia.height}`;
    meta.aspectRatio = (parsedMedia.width / parsedMedia.height).toFixed(2);
  }

  if (parsedMedia.durationSeconds) {
    meta.durationFormatted = `${Math.floor(parsedMedia.durationSeconds / 60)}:${String(parsedMedia.durationSeconds % 60).padStart(2, '0')}`;
  }

  // Science & Research File Detection
  const fileName = (parsedMedia.fileName || '').toLowerCase();
  const fileExt = (parsedMedia.fileExtension || '').toLowerCase();

  if (fileExt === 'pdb' || fileExt === 'cif' || fileExt === 'bcif') {
    meta.scienceType = 'MACROMOLECULAR_STRUCTURE';
    meta.scienceFormat = fileExt.toUpperCase();
    const pdbIdMatch = fileName.match(/([0-9][a-z0-9]{3})/i);
    if (pdbIdMatch) {
      meta.predictedPdbId = pdbIdMatch[1].toUpperCase();
      meta.rcsbPdbUrl = `https://www.rcsb.org/structure/${meta.predictedPdbId}`;
      scienceBadge = `ساختار سه‌بعدی پروتئین (PDB: ${meta.predictedPdbId})`;
    } else {
      scienceBadge = `ساختار ماکرومولکولی زیستی (${fileExt.toUpperCase()})`;
    }
  } else if (fileExt === 'fasta' || fileExt === 'fa' || fileExt === 'fna' || fileExt === 'faa') {
    meta.scienceType = 'GENOMIC_OR_PROTEIN_SEQUENCE';
    meta.scienceFormat = 'FASTA';
    scienceBadge = 'توالی ژنومی / پروتئینی (FASTA)';
  } else if (fileExt === 'sdf' || fileExt === 'mol' || fileExt === 'smi') {
    meta.scienceType = 'CHEMICAL_COMPOUND';
    meta.scienceFormat = fileExt.toUpperCase();
    scienceBadge = `ساختار شیمیایی مولکولی (${fileExt.toUpperCase()})`;
  } else if (fileExt === 'pdf') {
    // Check if filename contains PubMed PMID or DOI
    const pmidMatch = fileName.match(/pmid[_-]?(\d{6,9})/i);
    if (pmidMatch) {
      meta.scienceType = 'BIOMEDICAL_LITERATURE';
      meta.pmid = pmidMatch[1];
      meta.pubmedUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`;
      scienceBadge = `مقاله پژوهشی PubMed (PMID: ${pmidMatch[1]})`;
    }
  }

  return {
    mediaMetadataJson: Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
    scienceBadge,
  };
}

export function extractTelegramMetadata(message) {
  if (!message) return null;
  const raw = {
    message_id: message.message_id,
    date: message.date,
    forward_from: message.forward_from ? { id: message.forward_from.id, username: message.forward_from.username } : null,
    forward_from_chat: message.forward_from_chat ? { id: message.forward_from_chat.id, title: message.forward_from_chat.title } : null,
  };
  return JSON.stringify(raw);
}
