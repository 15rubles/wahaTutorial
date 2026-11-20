package app.muster.auth;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface InviteCodeRepository extends JpaRepository<InviteCode, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InviteCode i where i.code = ?1")
    Optional<InviteCode> findByCodeForUpdate(String code);

    @Query("select i from InviteCode i left join fetch i.usedBy join fetch i.createdBy order by i.createdAt desc")
    List<InviteCode> findAllNewestFirst();
}
