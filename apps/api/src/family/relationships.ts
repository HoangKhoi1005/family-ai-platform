import type { PoolClient } from 'pg';
import type {
  RelationshipDto,
  RelationshipGraphNodeDto,
  RelationshipGraphResponse,
  RelationshipSubtype,
  RelationshipType,
} from '@family/contracts';
import { FamilyHttpError } from './authorization.js';

const MAX_GRAPH_NODES = 100;

interface GraphNodeRow {
  id: string;
  display_name: string;
  familiar_name: string | null;
  hometown: string | null;
  birth_date: string | null;
  birth_year: number | null;
  deceased: boolean;
  version: number;
  distance: number;
}

interface RelationshipRow {
  id: string;
  from_member_id: string;
  to_member_id: string;
  type: RelationshipType;
  subtype: RelationshipSubtype;
  start_date: string | null;
  end_date: string | null;
  version: number;
}

function mapNode(row: GraphNodeRow): RelationshipGraphNodeDto {
  return {
    id: row.id,
    display_name: row.display_name,
    familiar_name: row.familiar_name,
    hometown: row.hometown,
    birth_date: row.birth_date,
    birth_year: row.birth_year,
    deceased: row.deceased,
    version: row.version,
    distance: row.distance,
  };
}

function mapRelationship(row: RelationshipRow): RelationshipDto {
  return {
    id: row.id,
    from_member_id: row.from_member_id,
    to_member_id: row.to_member_id,
    type: row.type,
    subtype: row.subtype,
    start_date: row.start_date,
    end_date: row.end_date,
    version: row.version,
  };
}

export async function getRelationshipGraph(
  client: PoolClient,
  input: { familyId: string; rootMemberId: string; depth: number },
): Promise<RelationshipGraphResponse> {
  if (!Number.isInteger(input.depth) || input.depth < 1 || input.depth > 4) {
    throw new FamilyHttpError(400, 'VALIDATION_ERROR', 'Độ sâu cây gia phả không hợp lệ.');
  }

  const nodes = await client.query<GraphNodeRow>(
    `WITH RECURSIVE walk(member_id, distance) AS (
       SELECT $2::uuid, 0
       UNION
       SELECT
         CASE
           WHEN relationship.from_member_id = walk.member_id THEN relationship.to_member_id
           ELSE relationship.from_member_id
         END,
         walk.distance + 1
       FROM walk
       JOIN relationships relationship
         ON relationship.family_id = $1
        AND relationship.removed_at IS NULL
        AND (relationship.from_member_id = walk.member_id OR relationship.to_member_id = walk.member_id)
      WHERE walk.distance < $3
     ), nearest AS (
       SELECT member_id, min(distance)::integer AS distance
         FROM walk
        GROUP BY member_id
     )
     SELECT member.id, member.display_name, member.familiar_name, member.hometown,
            member.birth_date::text AS birth_date, member.birth_year, member.deceased,
            member.version, nearest.distance
       FROM nearest
       JOIN members member
         ON member.family_id = $1 AND member.id = nearest.member_id
      ORDER BY nearest.distance, member.display_name, member.id
      LIMIT 101`,
    [input.familyId, input.rootMemberId, input.depth],
  );

  if (nodes.rows.length === 0) {
    throw new FamilyHttpError(404, 'NOT_FOUND', 'Không tìm thấy người thân trong nhà này.');
  }
  if (nodes.rows.length > MAX_GRAPH_NODES) {
    throw new FamilyHttpError(
      400,
      'GRAPH_TOO_LARGE',
      'Nhánh gia phả quá lớn. Vui lòng chọn độ sâu nhỏ hơn.',
    );
  }

  const memberIds = nodes.rows.map((row) => row.id);
  const relationships = await client.query<RelationshipRow>(
    `SELECT id, from_member_id, to_member_id, type, subtype,
            start_date::text AS start_date, end_date::text AS end_date, version
       FROM relationships
      WHERE family_id = $1
        AND removed_at IS NULL
        AND from_member_id = ANY($2::uuid[])
        AND to_member_id = ANY($2::uuid[])
      ORDER BY type, id`,
    [input.familyId, memberIds],
  );

  return {
    root_member_id: input.rootMemberId,
    depth: input.depth,
    nodes: nodes.rows.map(mapNode),
    relationships: relationships.rows.map(mapRelationship),
  };
}
