import { listRecruitmentsForProject, createRecruitment } from '../../../api/recruitmentApi';

export async function getOrCreateRecruitment(projectId, manpowerId) {
  const recruitments = await listRecruitmentsForProject(projectId);
  let recruitment = recruitments.find(r => r.sanctionedManpowerPositionId === manpowerId);
  
  if (!recruitment) {
    // Backend API returns the new Guid directly
    return await createRecruitment(projectId, { sanctionedManpowerPositionId: manpowerId });
  }
  
  return recruitment.id;
}
