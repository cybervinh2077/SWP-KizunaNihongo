import TeacherLayout from '../../components/layout/TeacherLayout';
import { QuestionBankManager } from '../admin/AdminQuestionBank';

// Teacher entry point — drives the teacher's PRIVATE question bank (full CRUD +
// AI generate + private reading passages), plus a read-only "Ngân hàng chung"
// tab for browsing and importing from the admin global bank.
export default function TeacherQuestionBank() {
  return (
    <QuestionBankManager
      apiBase="/teacher"
      Layout={TeacherLayout}
      title="Ngân hàng câu hỏi của tôi"
      breadcrumb="Giáo viên / Ngân hàng câu hỏi"
      showGlobalImport
    />
  );
}