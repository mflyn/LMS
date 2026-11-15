const C = require('./ai3Contract');

function createAi3SourceReader({ sourceReader, mistakeEvidenceClient }) {
  return { async availability(input) {
    try {
      // Historical reads need source existence, not a parent-only review context.
      const source = await sourceReader.require(input);
      return source?.id === (input.sourceTaskId || input.sourceMistakeId)
        && source.familyId === input.familyId && source.childId === input.childId ? 'available' : 'unavailable';
    } catch (cause) {
      if (cause.statusCode === 403 && cause.code === 'CHILD_ACCESS_DENIED') throw cause;
      return cause.statusCode === 404 && cause.code === 'RESOURCE_NOT_FOUND' ? 'missing' : 'unavailable';
    }
  }, async require(input) {
    const source = await sourceReader.require(input);
    if (!input.sourceMistakeId) return source;
    // Keep the legacy source DTO unchanged; the AI3 endpoint authorizes the actor and original association.
    const context = await mistakeEvidenceClient.getContext({ familyId: input.familyId, childId: input.childId,
      actorId: input.actorId, targetId: source.id });
    if (context?.id !== source.id || !Object.hasOwn(context, 'knowledgePointId')
      || context.knowledgePointId !== null && !C.isId(context.knowledgePointId)) throw C.error(503, 'SOURCE_SERVICE_UNAVAILABLE');
    return { ...source, knowledgePointId: context.knowledgePointId };
  } };
}

module.exports = { createAi3SourceReader };
